-- Hot takes spec (#67), ticket #72: guests answer Agree or Disagree.
--
-- One answer per guest and hot take, and the count of answers kept on the hot
-- take. The answers are secret: no one but the guest who gave one reads an
-- answer row, not the host and not the TV. The tally is the reveal ticket's
-- job (a `security definer` function after the reveal).

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- Lets an answer name its hot take and its event together, so the database
-- itself keeps an answer's event the same as its hot take's.
alter table public.hot_takes
  add constraint hot_takes_id_event_id_key unique (id, event_id);

-- A guest's answer to a hot take: `agree` is true for Agree, false for
-- Disagree. Deleted with the hot take, the event and the guest's membership.
-- Being a guest (not the host or the TV) is checked by the insert and update
-- policies.
create table public.hot_take_answers (
  hot_take_id uuid not null,
  event_id uuid not null,
  guest_id uuid not null,
  agree boolean not null,
  updated_at timestamptz not null default now(),
  primary key (hot_take_id, guest_id),
  foreign key (hot_take_id, event_id)
    references public.hot_takes (id, event_id) on delete cascade,
  foreign key (event_id, guest_id)
    references public.members (event_id, user_id) on delete cascade
);

create index hot_take_answers_event_id_idx
  on public.hot_take_answers (event_id);

-- ---------------------------------------------------------------------------
-- Keeping the answer time and the count
-- ---------------------------------------------------------------------------

create function private.touch_hot_take_answer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.touch_hot_take_answer() from public;

create trigger hot_take_answers_touch
  before update on public.hot_take_answers
  for each row
  execute function private.touch_hot_take_answer();

-- Counts a new answer on its hot take, so members see "7 of 12 answered"
-- through the hot take row without reading any answer. Changing an answer
-- doesn't change the count. Runs as the owner: no client writes hot takes.
create function private.count_hot_take_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hot_takes h
  set answer_count = h.answer_count + 1
  where h.id = new.hot_take_id;
  return null;
end;
$$;

revoke execute on function private.count_hot_take_answer() from public;

create trigger hot_take_answers_count
  after insert on public.hot_take_answers
  for each row
  execute function private.count_hot_take_answer();

-- ---------------------------------------------------------------------------
-- Helper function for policies
-- ---------------------------------------------------------------------------

-- Whether the caller may answer this hot take of this event: they are a guest
-- of the event, the hot take is an approved hot take of that event, and the
-- event runs hot takes on its position with the phase open.
-- `security definer` so that the policy does not depend on what the caller
-- may read in `events`, `hot_takes` and `members`.
create function public.can_answer_hot_take(
  target_hot_take_id uuid,
  target_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.hot_takes h
    join public.events e on e.id = h.event_id
    join public.members m on m.event_id = e.id
    where h.id = target_hot_take_id
      and h.event_id = target_event_id
      and h.status = 'approved'
      and e.expires_at > pg_catalog.now()
      and e.status = 'live'
      and e.current_module = 'hottakes'
      and e.current_step = h.position
      and e.phase = 'open'
      and m.user_id = (select auth.uid())
      and m.role = 'guest'
  );
$$;

revoke execute on function public.can_answer_hot_take(uuid, uuid)
  from public, anon;
grant execute on function public.can_answer_hot_take(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.hot_take_answers from anon, authenticated;

-- Reading: a guest their own answers. The host, the TV and non-members read
-- none, on purpose: the answers are secret.
grant select on public.hot_take_answers to authenticated;
alter table public.hot_take_answers enable row level security;

create policy "Guests read their own answers"
  on public.hot_take_answers for select
  to authenticated
  using (guest_id = (select auth.uid()) and public.is_member(event_id));

-- Writing: a guest inserts and changes only their own row, only while the hot
-- take is open. The column grants keep hot take, event and guest fixed on
-- update. Nobody deletes through the API.
grant insert (hot_take_id, event_id, guest_id, agree)
  on public.hot_take_answers to authenticated;
grant update (agree) on public.hot_take_answers to authenticated;

create policy "Guests answer an open hot take"
  on public.hot_take_answers for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    and public.can_answer_hot_take(hot_take_id, event_id)
  );

create policy "Guests change their answer while the hot take is open"
  on public.hot_take_answers for update
  to authenticated
  using (
    guest_id = (select auth.uid())
    and public.can_answer_hot_take(hot_take_id, event_id)
  )
  with check (
    guest_id = (select auth.uid())
    and public.can_answer_hot_take(hot_take_id, event_id)
  );
