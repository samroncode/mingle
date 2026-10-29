-- Host control panel spec (#75), ticket #80: the host removes a guest.
--
-- A removed guest keeps their row, with a removed time, so the join
-- functions can tell their phone it was removed instead of letting it join
-- again. Everywhere else a removed member counts as no member: the helper
-- functions, the members policies, the join functions and the lists of
-- scores and winners all leave them out. host-actions checks the admin key,
-- then writes with remove_guest.

-- ---------------------------------------------------------------------------
-- The removed time
-- ---------------------------------------------------------------------------

-- Set only by remove_guest. Clients have no column grant to write it: guests
-- may update display_name and nothing else (core migration).
alter table public.members add column removed_at timestamptz;

-- A removed guest's name is free again. Same index name, so the data layer
-- keeps mapping a violation to `name_taken`.
drop index public.members_guest_name_key;
create unique index members_guest_name_key
  on public.members (event_id, lower(display_name))
  where role = 'guest' and removed_at is null;

-- ---------------------------------------------------------------------------
-- Membership ignores removed rows
-- ---------------------------------------------------------------------------

create or replace function public.is_member(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.events e on e.id = m.event_id
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.removed_at is null
      and e.expires_at > pg_catalog.now()
  );
$$;

create or replace function public.is_host(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.events e on e.id = m.event_id
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'host'
      and m.removed_at is null
      and e.expires_at > pg_catalog.now()
  );
$$;

-- Members read the members of their event, except the removed ones.
drop policy "Members can read the members of their event" on public.members;
create policy "Members can read the members of their event"
  on public.members for select
  to authenticated
  using (removed_at is null and public.is_member(event_id));

-- A removed guest can't rename themselves.
drop policy "Guests can rename themselves" on public.members;
create policy "Guests can rename themselves"
  on public.members for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and role = 'guest'
    and removed_at is null
    and public.is_member(event_id)
  )
  with check (
    user_id = (select auth.uid())
    and role = 'guest'
    and removed_at is null
    and public.is_member(event_id)
  );

-- ---------------------------------------------------------------------------
-- The join functions answer `removed`
-- ---------------------------------------------------------------------------

-- Same as in the core migration, except that a member who was removed gets
-- the error `removed` whatever name they send, instead of the event id. The
-- error codes are now: `not_found`, `ended`, `name_taken`, `invalid_name`,
-- `rate_limited` and `removed`.
create or replace function public.join_event(code text, display_name text)
returns public.join_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  found record;
  already_in boolean;
  was_removed boolean;
  clean_name text;
  violated_constraint text;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  found := private.find_event_for_join(caller, join_event.code);
  if found.error is not null then
    return row(null, found.error)::public.join_result;
  end if;

  select true, m.removed_at is not null into already_in, was_removed
  from public.members m
  where m.event_id = (found.target).id and m.user_id = caller;
  if was_removed then
    return row(null, 'removed')::public.join_result;
  end if;
  if already_in then
    return row((found.target).id, null)::public.join_result;
  end if;

  if (found.target).status = 'ended' then
    return row(null, 'ended')::public.join_result;
  end if;

  clean_name := private.clean_display_name(join_event.display_name);
  if coalesce(pg_catalog.char_length(clean_name), 0) not between 1 and 30 then
    return row(null, 'invalid_name')::public.join_result;
  end if;

  begin
    insert into public.members (event_id, user_id, role, display_name)
    values ((found.target).id, caller, 'guest', clean_name);
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'members_guest_name_key' then
      return row(null, 'name_taken')::public.join_result;
    end if;
    -- Otherwise the same session joined at the same moment in another request.
  end;

  return row((found.target).id, null)::public.join_result;
end;
$$;

create or replace function public.join_tv(code text)
returns public.join_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  found record;
  already_in boolean;
  was_removed boolean;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  found := private.find_event_for_join(caller, join_tv.code);
  if found.error is not null then
    return row(null, found.error)::public.join_result;
  end if;

  select true, m.removed_at is not null into already_in, was_removed
  from public.members m
  where m.event_id = (found.target).id and m.user_id = caller;
  if was_removed then
    return row(null, 'removed')::public.join_result;
  end if;
  if already_in then
    return row((found.target).id, null)::public.join_result;
  end if;

  if (found.target).status = 'ended' then
    return row(null, 'ended')::public.join_result;
  end if;

  insert into public.members (event_id, user_id, role)
  values ((found.target).id, caller, 'tv')
  on conflict (event_id, user_id) do nothing;

  return row((found.target).id, null)::public.join_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- A removed guest can't answer or vote, and nobody can vote for them
-- ---------------------------------------------------------------------------

create or replace function public.can_answer_quiz_question(
  target_question_id uuid,
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
    from public.quiz_questions q
    join public.events e on e.id = q.event_id
    join public.members m on m.event_id = e.id
    where q.id = target_question_id
      and q.event_id = target_event_id
      and q.status = 'approved'
      and e.expires_at > pg_catalog.now()
      and e.status = 'live'
      and e.current_module = 'quiz'
      and e.current_step = q.position
      and e.phase = 'open'
      and m.user_id = (select auth.uid())
      and m.role = 'guest'
      and m.removed_at is null
  );
$$;

create or replace function public.can_vote_award(
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
      and voter.removed_at is null
      and pick.user_id = target_guest_id
      and pick.user_id <> voter.user_id
      and pick.role = 'guest'
      and pick.display_name is not null
      and pick.removed_at is null
  );
$$;

create or replace function public.can_answer_hot_take(
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
      and m.removed_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Scores, winners and counts leave removed guests out
-- ---------------------------------------------------------------------------

create or replace function public.quiz_scores(target_event_id uuid)
returns table (user_id uuid, display_name text, score integer, place integer)
language sql
stable
security definer
set search_path = ''
as $$
  with guests as (
    select
      m.user_id,
      m.display_name,
      (
        select count(*)
        from public.quiz_answers a
        join public.quiz_questions q on q.id = a.question_id
        join public.quiz_answer_keys k on k.question_id = q.id
        where a.user_id = m.user_id
          and q.event_id = m.event_id
          and q.status = 'approved'
          and q.revealed_at is not null
          and a.chosen = k.correct
      )::integer as score
    from public.members m
    where m.event_id = target_event_id
      and m.role = 'guest'
      and m.removed_at is null
  ),
  placed as (
    select
      g.user_id,
      g.display_name,
      g.score,
      (pg_catalog.rank() over (order by g.score desc))::integer as place
    from guests g
  ),
  finished as (
    select
      exists (
        select 1
        from public.quiz_questions q
        where q.event_id = target_event_id and q.status = 'approved'
      )
      and not exists (
        select 1
        from public.quiz_questions q
        where q.event_id = target_event_id
          and q.status = 'approved'
          and q.revealed_at is null
      ) as done
  )
  select p.user_id, p.display_name, p.score, p.place
  from placed p
  cross join finished f
  where public.is_member(target_event_id)
    and (
      public.is_host(target_event_id)
      or p.user_id = (select auth.uid())
      or (f.done and p.place <= 3)
    )
  order by p.place, p.display_name, p.user_id;
$$;

create or replace function private.award_counts(target_event_id uuid)
returns table (category_id uuid, user_id uuid, votes integer)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    g.user_id,
    (
      select count(*)
      from public.award_votes v
      where v.category_id = c.id and v.voted_for_id = g.user_id
    )::integer
  from public.award_categories c
  join public.members g on g.event_id = c.event_id
  where c.event_id = target_event_id
    and c.status = 'approved'
    and c.revealed_at is not null
    and g.role = 'guest'
    and g.display_name is not null
    and g.removed_at is null;
$$;

create or replace function public.awards_won(target_event_id uuid)
returns table (user_id uuid, awards integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.user_id,
    (
      select count(*)
      from private.award_winners(target_event_id) w
      where w.user_id = g.user_id
    )::integer
  from public.members g
  where g.event_id = target_event_id
    and g.role = 'guest'
    and g.display_name is not null
    and g.removed_at is null
    and public.is_member(target_event_id)
    and (public.is_host(target_event_id) or g.user_id = (select auth.uid()))
  order by g.user_id;
$$;

-- Who has voted on the current category: a removed guest's vote on a
-- revealed category stays in the table but is not listed.
create or replace function public.award_voters(target_category_id uuid)
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
  join public.members m
    on m.event_id = v.event_id and m.user_id = v.voter_id
  where c.id = target_category_id
    and c.status = 'approved'
    and e.current_module = 'awards'
    and e.current_step = c.position
    and m.removed_at is null
    and public.is_host(c.event_id);
$$;

create or replace function private.hot_take_counts(target_event_id uuid)
returns table (
  hot_take_id uuid,
  hot_take_position integer,
  hot_take_text text,
  agree_count integer,
  disagree_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    h.id,
    h.position,
    h.text,
    (
      select count(*)
      from public.hot_take_answers a
      join public.members g
        on g.event_id = a.event_id and g.user_id = a.guest_id
      where a.hot_take_id = h.id
        and a.agree
        and g.role = 'guest'
        and g.display_name is not null
        and g.removed_at is null
    )::integer,
    (
      select count(*)
      from public.hot_take_answers a
      join public.members g
        on g.event_id = a.event_id and g.user_id = a.guest_id
      where a.hot_take_id = h.id
        and not a.agree
        and g.role = 'guest'
        and g.display_name is not null
        and g.removed_at is null
    )::integer
  from public.hot_takes h
  where h.event_id = target_event_id
    and h.status = 'approved'
    and h.revealed_at is not null;
$$;

create or replace function public.my_hot_take_majority(target_event_id uuid)
returns table (sided integer, answered integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*) filter (
      where a.agree = (n.agree_count > n.disagree_count)
    ))::integer,
    (count(*))::integer
  from private.hot_take_counts(target_event_id) n
  join public.hot_take_answers a on a.hot_take_id = n.hot_take_id
  where a.guest_id = (select auth.uid())
    and n.agree_count <> n.disagree_count
  having exists (
    select 1
    from public.members m
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'guest'
      and m.display_name is not null
      and m.removed_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- Removing a guest
-- ---------------------------------------------------------------------------

-- Removes the guest `target_user_id` of the event, in one transaction:
-- sets their removed time, deletes their answers and votes on items that
-- aren't revealed yet (quiz answers, hot take answers, award votes they cast
-- and award votes for them) and takes those off the items' counts. Rows on
-- revealed items stay, but the results leave the guest out.
--
-- Answers, changing nothing:
--   'no_event'   the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'not_found'  the user isn't a guest of this event, or is already removed
-- and 'removed' once written. Called by host-actions only.
create function public.remove_guest(
  target_event_id uuid,
  target_user_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_status text;
begin
  -- Waits for a flow move in progress, so a reveal can't slip between the
  -- check of what is revealed and the deletes below.
  select e.status into event_status
  from public.events e
  where e.id = remove_guest.target_event_id
    and e.expires_at > pg_catalog.now()
  for no key update;
  if not found then
    return 'no_event';
  end if;
  if event_status = 'ended' then
    return 'ended';
  end if;

  update public.members m
  set removed_at = pg_catalog.now()
  where m.event_id = remove_guest.target_event_id
    and m.user_id = remove_guest.target_user_id
    and m.role = 'guest'
    and m.removed_at is null;
  if not found then
    return 'not_found';
  end if;

  with gone as (
    delete from public.quiz_answers a
    using public.quiz_questions q
    where q.id = a.question_id
      and q.revealed_at is null
      and a.event_id = remove_guest.target_event_id
      and a.user_id = remove_guest.target_user_id
    returning a.question_id
  ),
  per_question as (
    select g.question_id, pg_catalog.count(*)::integer as removed
    from gone g
    group by g.question_id
  )
  update public.quiz_questions q
  set answer_count = q.answer_count - p.removed
  from per_question p
  where q.id = p.question_id;

  with gone as (
    delete from public.hot_take_answers a
    using public.hot_takes h
    where h.id = a.hot_take_id
      and h.revealed_at is null
      and a.event_id = remove_guest.target_event_id
      and a.guest_id = remove_guest.target_user_id
    returning a.hot_take_id
  ),
  per_take as (
    select g.hot_take_id, pg_catalog.count(*)::integer as removed
    from gone g
    group by g.hot_take_id
  )
  update public.hot_takes h
  set answer_count = h.answer_count - p.removed
  from per_take p
  where h.id = p.hot_take_id;

  with gone as (
    delete from public.award_votes v
    using public.award_categories c
    where c.id = v.category_id
      and c.revealed_at is null
      and v.event_id = remove_guest.target_event_id
      and (
        v.voter_id = remove_guest.target_user_id
        or v.voted_for_id = remove_guest.target_user_id
      )
    returning v.category_id
  ),
  per_category as (
    select g.category_id, pg_catalog.count(*)::integer as removed
    from gone g
    group by g.category_id
  )
  update public.award_categories c
  set vote_count = c.vote_count - p.removed
  from per_category p
  where c.id = p.category_id;

  -- Realtime hides a row from anyone who can no longer read it, so the
  -- removal of a member would reach no one. A write to the event, which
  -- members still read, tells the TV and the host to read the members again.
  -- Setting a column to itself changes no value and starts no trigger.
  update public.events e
  set phase = e.phase
  where e.id = remove_guest.target_event_id;

  return 'removed';
end;
$$;

revoke execute on function public.remove_guest(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_guest(uuid, uuid) to service_role;
