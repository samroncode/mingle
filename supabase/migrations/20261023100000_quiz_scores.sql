-- Quiz spec (#49), ticket #56: scores and results.
--
-- One point per right answer on played (revealed) questions, no speed bonus.
-- Only guests have scores. Scores follow the member, not the display name, so
-- a rename keeps them; a guest who joined late has 0 for the questions they
-- missed.

-- ---------------------------------------------------------------------------
-- Scores
-- ---------------------------------------------------------------------------

-- The guests' scores with competition places (ties share a place: 1, 1, 3),
-- best first, for a member of the event. What each role gets:
--   host         every guest, at any time
--   guest        their own row at any time, and the top 3 places once the
--                quiz is finished (it has questions and all are played)
--   TV           the top 3 places once the quiz is finished
--   non-member   nothing
-- `security definer` because no client reads other guests' answers or the
-- right answers of unplayed questions; only revealed questions are counted.
create function public.quiz_scores(target_event_id uuid)
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

revoke execute on function public.quiz_scores(uuid) from public, anon;
grant execute on function public.quiz_scores(uuid) to authenticated;
