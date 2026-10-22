-- Quiz spec (#49), ticket #55: guests answer.
--
-- One answer per guest and question, the count of answers kept on the
-- question, and the votes per option once a question is revealed.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- Lets an answer name its question and its event together, so the database
-- itself keeps an answer's event the same as its question's.
alter table public.quiz_questions
  add constraint quiz_questions_id_event_id_key unique (id, event_id);

-- A guest's chosen option (0-3) for a question. Deleted with the question,
-- the event and the guest's membership.
create table public.quiz_answers (
  question_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  chosen integer not null check (chosen between 0 and 3),
  updated_at timestamptz not null default now(),
  primary key (question_id, user_id),
  foreign key (question_id, event_id)
    references public.quiz_questions (id, event_id) on delete cascade,
  foreign key (event_id, user_id)
    references public.members (event_id, user_id) on delete cascade
);

create index quiz_answers_event_id_idx on public.quiz_answers (event_id);

-- ---------------------------------------------------------------------------
-- Keeping the answer time and the count
-- ---------------------------------------------------------------------------

create function private.touch_quiz_answer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke execute on function private.touch_quiz_answer() from public;

create trigger quiz_answers_touch
  before update on public.quiz_answers
  for each row
  execute function private.touch_quiz_answer();

-- Counts a new answer on its question, so members see "7 of 12 answered"
-- through the question row without reading any answer. Changing an answer
-- doesn't change the count. Runs as the owner: no client writes questions.
create function private.count_quiz_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.quiz_questions q
  set answer_count = q.answer_count + 1
  where q.id = new.question_id;
  return null;
end;
$$;

revoke execute on function private.count_quiz_answer() from public;

create trigger quiz_answers_count
  after insert on public.quiz_answers
  for each row
  execute function private.count_quiz_answer();

-- ---------------------------------------------------------------------------
-- Helper function for policies
-- ---------------------------------------------------------------------------

-- Whether the caller may write an answer to this question of this event: they
-- are a guest of the event, the question is an approved question of that
-- event, and the event runs the quiz on its position with the phase open.
-- `security definer` so that the policy does not depend on what the caller
-- may read in `events` and `quiz_questions`.
create function public.can_answer_quiz_question(
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
  );
$$;

revoke execute on function public.can_answer_quiz_question(uuid, uuid)
  from public, anon;
grant execute on function public.can_answer_quiz_question(uuid, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.quiz_answers from anon, authenticated;

-- Reading: a guest their own answers, the host every answer of their event.
-- The TV and non-members read none.
grant select on public.quiz_answers to authenticated;
alter table public.quiz_answers enable row level security;

create policy "Guests read their own answers, the host reads all"
  on public.quiz_answers for select
  to authenticated
  using (
    public.is_host(event_id)
    or (user_id = (select auth.uid()) and public.is_member(event_id))
  );

-- Writing: a guest inserts and changes only their own row, only while the
-- question is open. The column grants keep question, event and user fixed on
-- update. Nobody deletes through the API.
grant insert (question_id, event_id, user_id, chosen)
  on public.quiz_answers to authenticated;
grant update (chosen) on public.quiz_answers to authenticated;

create policy "Guests answer an open question"
  on public.quiz_answers for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and public.can_answer_quiz_question(question_id, event_id)
  );

create policy "Guests change their answer while the question is open"
  on public.quiz_answers for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and public.can_answer_quiz_question(question_id, event_id)
  )
  with check (
    user_id = (select auth.uid())
    and public.can_answer_quiz_question(question_id, event_id)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- The host's list of who has answered follows the answers.
alter publication supabase_realtime add table public.quiz_answers;

-- ---------------------------------------------------------------------------
-- Votes per option
-- ---------------------------------------------------------------------------

-- How many guests picked each option (0-3) of a question, once the question
-- is revealed and only for a member of its event. Before the reveal, for a
-- non-member or for an unknown question there are no rows, so nobody learns
-- anything. `security definer` because no client reads other guests' answers.
create function public.quiz_votes(target_question_id uuid)
returns table (option integer, votes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.option,
    (
      select count(*)
      from public.quiz_answers a
      where a.question_id = q.id and a.chosen = o.option
    )::integer
  from public.quiz_questions q
  cross join pg_catalog.generate_series(0, 3) as o(option)
  where q.id = target_question_id
    and q.status = 'approved'
    and q.revealed_at is not null
    and public.is_member(q.event_id)
  order by o.option;
$$;

revoke execute on function public.quiz_votes(uuid) from public, anon;
grant execute on function public.quiz_votes(uuid) to authenticated;
