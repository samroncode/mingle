-- Quiz spec (#49), ticket #57: the host edits the unplayed questions during
-- the evening.
--
-- host-actions validates the questions with the shared quiz schema and
-- writes them with update_quiz_questions, after the admin key check passed.

-- Replaces the event's unplayed quiz questions (not revealed yet) with
-- `questions`, a JSON array of `{ text, options, correct }` in the order
-- chosen, placed after the played ones. Played questions keep their text,
-- options, answer key, reveal time and answers. They move up to the first
-- positions in their order, so the steps stay 0, 1, 2, ... even after the
-- host skipped a question; while the quiz runs, its step moves to the first
-- unplayed question, where start_module would resume.
--
-- Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'busy'       the quiz is on a question that is open or revealed
--   'finished'   every question has been played, so the quiz stays finished
--   'disabled'   questions for an event with the quiz switched off
--   'too_many'   played and new questions together are more than 30
-- and 'updated' once written.
--
-- The event row is locked first, so a flow move (open, reveal) that lands
-- meanwhile waits for this transaction and then finds the flow it read gone;
-- and this function, waiting for a move, sees the move's result. A question
-- is never changed after it was shown. Called by host-actions only.
create function public.update_quiz_questions(
  target_event_id uuid,
  questions jsonb
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.events%rowtype;
  played_count integer;
  unplayed_count integer;
  new_position integer := 0;
  played_id uuid;
begin
  select e.* into target
  from public.events e
  where e.id = update_quiz_questions.target_event_id
    and e.expires_at > pg_catalog.now()
  for update;
  if not found then
    return 'not_found';
  end if;
  if target.status = 'ended' then
    return 'ended';
  end if;
  if target.current_module = 'quiz' and target.phase <> 'idle' then
    return 'busy';
  end if;

  select
    (count(*) filter (where q.revealed_at is not null))::integer,
    (count(*) filter (where q.revealed_at is null))::integer
  into played_count, unplayed_count
  from public.quiz_questions q
  where q.event_id = target.id;

  if played_count > 0 and unplayed_count = 0 then
    return 'finished';
  end if;
  if pg_catalog.jsonb_array_length(update_quiz_questions.questions) > 0
    and not ('quiz' = any (target.enabled_modules)) then
    return 'disabled';
  end if;
  if played_count
    + pg_catalog.jsonb_array_length(update_quiz_questions.questions) > 30 then
    return 'too_many';
  end if;

  delete from public.quiz_questions q
  where q.event_id = target.id
    and q.revealed_at is null;

  -- One row at a time, lowest first: a played question only ever moves down
  -- to a free position, so (event_id, position) stays unique on every row.
  for played_id in
    select q.id
    from public.quiz_questions q
    where q.event_id = target.id
    order by q.position
  loop
    update public.quiz_questions q
    set position = new_position
    where q.id = played_id
      and q.position <> new_position;
    new_position := new_position + 1;
  end loop;

  with inserted as (
    insert into public.quiz_questions (event_id, position, text, options)
    select
      target.id,
      played_count + (q.ordinality - 1)::integer,
      q.value ->> 'text',
      array(
        select o.value
        from pg_catalog.jsonb_array_elements_text(q.value -> 'options')
          with ordinality as o(value, ordinality)
        order by o.ordinality
      )
    from pg_catalog.jsonb_array_elements(update_quiz_questions.questions)
      with ordinality as q(value, ordinality)
    returning id, position
  )
  insert into public.quiz_answer_keys (question_id, correct)
  select i.id, (q.value ->> 'correct')::integer
  from inserted i
  join pg_catalog.jsonb_array_elements(update_quiz_questions.questions)
    with ordinality as q(value, ordinality)
    on i.position = played_count + q.ordinality - 1;

  if target.current_module = 'quiz' then
    update public.events e
    set current_step = played_count
    where e.id = target.id
      and e.current_step <> played_count;
  end if;

  return 'updated';
end;
$$;

revoke execute on function public.update_quiz_questions(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_quiz_questions(uuid, jsonb)
  to service_role;
