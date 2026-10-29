-- Awards spec (#59), ticket #64: guests vote.
--
-- One vote per guest and category, the count of votes kept on the category,
-- and the host's list of who has voted. The votes are secret: no one but the
-- voter reads a vote row, not the host and not the TV. The tally is the
-- reveal ticket's job (a `security definer` function after the reveal).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- Lets a vote name its category and its event together, so the database
-- itself keeps a vote's event the same as its category's.
alter table public.award_categories
  add constraint award_categories_id_event_id_key unique (id, event_id);

-- The guest a voter picked for a category. Deleted with the category, the
-- event and either guest's membership. The pick is a member of the same event
-- by the foreign key; being a guest with a display name is checked by the
-- insert and update policies.
create table public.award_votes (
  category_id uuid not null,
  event_id uuid not null,
  voter_id uuid not null,
  voted_for_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (category_id, voter_id),
  check (voted_for_id <> voter_id),
  foreign key (category_id, event_id)
    references public.award_categories (id, event_id) on delete cascade,
  foreign key (event_id, voter_id)
    references public.members (event_id, user_id) on delete cascade,
  foreign key (event_id, voted_for_id)
    references public.members (event_id, user_id) on delete cascade
);

create index award_votes_event_id_idx on public.award_votes (event_id);

-- ---------------------------------------------------------------------------
-- Keeping the vote time and the count
-- ---------------------------------------------------------------------------

create function private.touch_award_vote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.touch_award_vote() from public;

create trigger award_votes_touch
  before update on public.award_votes
  for each row
  execute function private.touch_award_vote();

-- Counts a new vote on its category, so members see "7 of 12 voted" through
-- the category row without reading any vote. Changing a vote doesn't change
-- the count. Runs as the owner: no client writes categories.
create function private.count_award_vote()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.award_categories c
  set vote_count = c.vote_count + 1
  where c.id = new.category_id;
  return null;
end;
$$;

revoke execute on function private.count_award_vote() from public;

create trigger award_votes_count
  after insert on public.award_votes
  for each row
  execute function private.count_award_vote();

-- ---------------------------------------------------------------------------
-- Helper function for policies
-- ---------------------------------------------------------------------------

-- Whether the caller may vote for this guest on this category of this event:
-- they are a guest of the event, the category is an approved category of that
-- event, the event runs the awards on its position with the phase open, and
-- the pick is another guest of the event who has a display name.
-- `security definer` so that the policy does not depend on what the caller
-- may read in `events`, `award_categories` and `members`.
create function public.can_vote_award(
  target_category_id uuid,
  target_event_id uuid,
  target_guest_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.award_categories c
    join public.events e on e.id = c.event_id
    join public.members voter on voter.event_id = e.id
    join public.members pick on pick.event_id = e.id
    where c.id = target_category_id
      and c.event_id = target_event_id
      and c.status = 'approved'
      and e.expires_at > pg_catalog.now()
      and e.status = 'live'
      and e.current_module = 'awards'
      and e.current_step = c.position
      and e.phase = 'open'
      and voter.user_id = (select auth.uid())
      and voter.role = 'guest'
      and pick.user_id = target_guest_id
      and pick.user_id <> voter.user_id
      and pick.role = 'guest'
      and pick.display_name is not null
  );
$$;

revoke execute on function public.can_vote_award(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.can_vote_award(uuid, uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.award_votes from anon, authenticated;

-- Reading: a guest their own votes. The host, the TV and non-members read
-- none, on purpose: the votes are secret.
grant select on public.award_votes to authenticated;
alter table public.award_votes enable row level security;

create policy "Guests read their own votes"
  on public.award_votes for select
  to authenticated
  using (voter_id = (select auth.uid()) and public.is_member(event_id));

-- Writing: a guest inserts and changes only their own row, only while the
-- category is open. The column grants keep category, event and voter fixed on
-- update. Nobody deletes through the API.
grant insert (category_id, event_id, voter_id, voted_for_id)
  on public.award_votes to authenticated;
grant update (voted_for_id) on public.award_votes to authenticated;

create policy "Guests vote on an open category"
  on public.award_votes for insert
  to authenticated
  with check (
    voter_id = (select auth.uid())
    and public.can_vote_award(category_id, event_id, voted_for_id)
  );

create policy "Guests change their vote while the category is open"
  on public.award_votes for update
  to authenticated
  using (
    voter_id = (select auth.uid())
    and public.can_vote_award(category_id, event_id, voted_for_id)
  )
  with check (
    voter_id = (select auth.uid())
    and public.can_vote_award(category_id, event_id, voted_for_id)
  );

-- ---------------------------------------------------------------------------
-- Who has voted
-- ---------------------------------------------------------------------------

-- The ids of the guests who have voted on the category the awards show now,
-- never whom they voted for. Only the host of the category's event gets
-- rows; anyone else, an unknown category and a category that is not the
-- current one get none. `security definer` because no client reads votes.
create function public.award_voters(target_category_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select v.voter_id
  from public.award_categories c
  join public.events e on e.id = c.event_id
  join public.award_votes v on v.category_id = c.id
  where c.id = target_category_id
    and c.status = 'approved'
    and e.current_module = 'awards'
    and e.current_step = c.position
    and public.is_host(c.event_id);
$$;

revoke execute on function public.award_voters(uuid) from public, anon;
grant execute on function public.award_voters(uuid) to authenticated;
