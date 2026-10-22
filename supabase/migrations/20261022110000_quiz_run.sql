-- Quiz spec (#49), ticket #54: the host runs the quiz.
--
-- A question counts as played once it has been revealed. The reveal is a
-- flow write (set_event_flow); the trigger below marks the question in that
-- same statement, so a revealed question is never left unmarked. host-actions
-- reads which questions are played to know where the quiz starts again.

-- ---------------------------------------------------------------------------
-- Marking the revealed question
-- ---------------------------------------------------------------------------

-- When the quiz's phase turns `revealed`, sets the revealed time of the
-- question on the current step. A question that already has a time keeps it,
-- so a later reveal never changes it. Runs as the owner: no client can write
-- quiz_questions, and the flow is only written by host-actions.
create function private.mark_quiz_question_revealed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quiz_questions q
  set revealed_at = pg_catalog.now()
  where q.event_id = new.id
    and q.position = new.current_step
    and q.status = 'approved'
    and q.revealed_at is null;
  return null;
end;
$$;

revoke execute on function private.mark_quiz_question_revealed() from public;

create trigger events_mark_quiz_question_revealed
  after update of phase on public.events
  for each row
  when (
    new.current_module = 'quiz'
    and new.phase = 'revealed'
    and old.phase is distinct from 'revealed'
  )
  execute function private.mark_quiz_question_revealed();

-- ---------------------------------------------------------------------------
-- The quiz's progress
-- ---------------------------------------------------------------------------

-- The number of approved questions and how many of them are played, so the
-- TV can say "Question 3 of 10" and the views know the results step (step =
-- total). One row for a member of the event; no rows for anyone else.
create function public.quiz_progress(target_event_id uuid)
returns table (total integer, played integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*))::integer,
    (count(*) filter (where q.revealed_at is not null))::integer
  from public.quiz_questions q
  where q.event_id = target_event_id
    and q.status = 'approved'
  having public.is_member(target_event_id);
$$;

revoke execute on function public.quiz_progress(uuid) from public, anon;
grant execute on function public.quiz_progress(uuid) to authenticated;
