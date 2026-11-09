-- Competitions spec (#262), ticket #264: guests report matches.
--
-- A guest reports a match they played: the competition, who won and who
-- lost, and optionally the score. Members of the event read the matches;
-- nobody writes the table from the client. Reporting goes through one
-- `security definer` function that checks everything the UI would.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- Lets a match name its competition and its event together, so the database
-- itself keeps a match's event the same as its competition's.
alter table public.competitions
  add constraint competitions_id_event_id_key unique (id, event_id);

-- A match is stored by member ids, never by name, so renaming a guest keeps
-- their matches. The rules of a match are checks, so a row that breaks them
-- can't exist whatever wrote it:
--   * winner and loser are two different guests,
--   * the reporter is one of them,
--   * a score is given for both or for neither, 0 to 999, and the winner's is
--     the higher one.
-- A match goes with its event, its competition and the membership of either
-- player.
create table public.competition_matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  competition_id uuid not null,
  winner_id uuid not null,
  loser_id uuid not null,
  winner_score smallint check (winner_score between 0 and 999),
  loser_score smallint check (loser_score between 0 and 999),
  reporter_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (competition_id, event_id)
    references public.competitions (id, event_id) on delete cascade,
  foreign key (event_id, winner_id)
    references public.members (event_id, user_id) on delete cascade,
  foreign key (event_id, loser_id)
    references public.members (event_id, user_id) on delete cascade,
  foreign key (event_id, reporter_id)
    references public.members (event_id, user_id) on delete cascade,
  constraint competition_matches_players_differ check (winner_id <> loser_id),
  constraint competition_matches_reporter_plays check (
    reporter_id in (winner_id, loser_id)
  ),
  constraint competition_matches_scores_agree check (
    (winner_score is null and loser_score is null)
    or (
      winner_score is not null
      and loser_score is not null
      and winner_score > loser_score
    )
  )
);

create index competition_matches_event_id_idx
  on public.competition_matches (event_id, created_at);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.competition_matches from anon, authenticated;

grant select on public.competition_matches to authenticated;
alter table public.competition_matches enable row level security;

create policy "Members can read the matches of their event"
  on public.competition_matches for select
  to authenticated
  using (public.is_member(event_id));

-- Views follow matches being reported and removed.
alter publication supabase_realtime add table public.competition_matches;

-- ---------------------------------------------------------------------------
-- Reporting a match
-- ---------------------------------------------------------------------------

-- The most matches one guest can report in an hour. Far above a busy evening
-- of darts, far below a script.
create function private.match_report_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30; $$;

revoke execute on function private.match_report_limit()
  from public, anon, authenticated;

-- Reports a match as the signed-in guest. Both scores are null, or both are
-- given. Answers a code, never text, and stores nothing unless the answer is
-- 'reported':
--   'not_found'            the caller isn't a guest of this event (a
--                          non-member, the host, a TV, a removed guest, a
--                          wrong or expired event all look the same)
--   'ended'                the event has ended
--   'disabled'             the event has Competitions switched off
--   'same_player'          winner and loser are the same
--   'not_a_participant'    the caller is neither the winner nor the loser
--   'unknown_competition'  no such competition in this event
--   'unknown_player'       winner or loser isn't a current guest of the event
--   'invalid_score'        one score only, or a score outside 0 to 999
--   'score_mismatch'       the winner's score isn't higher than the loser's
--   'rate_limited'         too many reports from this guest in an hour
create function public.report_match(
  target_event_id uuid,
  target_competition_id uuid,
  winner uuid,
  loser uuid,
  winner_score integer default null,
  loser_score integer default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  event_status text;
  modules text[];
begin
  if caller is null then
    return 'not_found';
  end if;

  -- Locks the event, so a report can't slip in after the evening ends.
  select e.status, e.enabled_modules into event_status, modules
  from public.events e
  where e.id = report_match.target_event_id
    and e.expires_at > pg_catalog.now()
    and exists (
      select 1
      from public.members m
      where m.event_id = e.id
        and m.user_id = caller
        and m.role = 'guest'
        and m.removed_at is null
    )
  for share of e;
  if not found then
    return 'not_found';
  end if;
  if event_status = 'ended' then
    return 'ended';
  end if;
  if not ('competitions' = any (modules)) then
    return 'disabled';
  end if;

  if report_match.winner = report_match.loser then
    return 'same_player';
  end if;
  if caller not in (report_match.winner, report_match.loser) then
    return 'not_a_participant';
  end if;

  if not exists (
    select 1
    from public.competitions c
    where c.id = report_match.target_competition_id
      and c.event_id = report_match.target_event_id
  ) then
    return 'unknown_competition';
  end if;

  if (
    select pg_catalog.count(*)
    from public.members m
    where m.event_id = report_match.target_event_id
      and m.user_id in (report_match.winner, report_match.loser)
      and m.role = 'guest'
      and m.removed_at is null
  ) <> 2 then
    return 'unknown_player';
  end if;

  if (report_match.winner_score is null) <> (report_match.loser_score is null)
    or report_match.winner_score not between 0 and 999
    or report_match.loser_score not between 0 and 999 then
    return 'invalid_score';
  end if;
  if report_match.winner_score <= report_match.loser_score then
    return 'score_mismatch';
  end if;

  -- Last, so a refused report doesn't use up the allowance.
  if not public.consume_rate_limit(
    caller, 'report_match', private.match_report_limit(), 3600
  ) then
    return 'rate_limited';
  end if;

  insert into public.competition_matches (
    event_id, competition_id, winner_id, loser_id,
    winner_score, loser_score, reporter_id
  )
  values (
    report_match.target_event_id,
    report_match.target_competition_id,
    report_match.winner,
    report_match.loser,
    report_match.winner_score,
    report_match.loser_score,
    caller
  );

  return 'reported';
end;
$$;

revoke execute on function public.report_match(
  uuid, uuid, uuid, uuid, integer, integer
) from public, anon;
grant execute on function public.report_match(
  uuid, uuid, uuid, uuid, integer, integer
) to authenticated;

-- ---------------------------------------------------------------------------
-- Removing a guest also removes their matches
-- ---------------------------------------------------------------------------

-- As in 20261030120000_remove_guest.sql, plus: every match the guest played
-- is deleted, won or lost, whoever reported it. Unlike a quiz answer, a match
-- has no reveal after which it stays: it is a record of two people, and one
-- of them is gone.
create or replace function public.remove_guest(
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

  delete from public.competition_matches cm
  where cm.event_id = remove_guest.target_event_id
    and remove_guest.target_user_id in (cm.winner_id, cm.loser_id);

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
