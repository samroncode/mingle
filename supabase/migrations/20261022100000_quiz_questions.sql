-- Quiz spec (#49), ticket #53: the quiz questions of an event, their answer
-- keys, and `create_event` taking the picked questions.
--
-- The right answers live in their own table so that "no peeking before the
-- reveal" is a plain RLS rule instead of column tricks.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- The limits match QuizQuestionSchema in src/lib/schemas/quiz.ts. A question
-- is a position in the event's quiz (from 0), so the quiz flow state
-- (`current_step`) refers to it by that position.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 0 and 29),
  text text not null check (
    char_length(text) between 1 and 200 and btrim(text) <> ''
  ),
  options text[] not null check (
    array_ndims(options) = 1
    and array_lower(options, 1) = 1
    and cardinality(options) = 4
    and array_position(options, null) is null
    and char_length(options[1]) between 1 and 80 and btrim(options[1]) <> ''
    and char_length(options[2]) between 1 and 80 and btrim(options[2]) <> ''
    and char_length(options[3]) between 1 and 80 and btrim(options[3]) <> ''
    and char_length(options[4]) between 1 and 80 and btrim(options[4]) <> ''
  ),
  -- Only `approved` questions are ever shown to guests or on the TV; `draft`
  -- is for AI suggestions later.
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  -- Null until the question is revealed; then it counts as played.
  revealed_at timestamptz,
  answer_count integer not null default 0 check (answer_count >= 0),
  unique (event_id, position)
);

-- The right option of each question, apart from the question so that
-- reading a question never reads its answer.
create table public.quiz_answer_keys (
  question_id uuid primary key
    references public.quiz_questions (id) on delete cascade,
  correct integer not null check (correct between 0 and 3)
);

-- ---------------------------------------------------------------------------
-- Helper functions for policies
-- ---------------------------------------------------------------------------

-- Whether the caller may read this question. The host reads every question
-- of their event. Other members read an approved question only while the
-- event shows it (the quiz is on its position with the phase open or
-- revealed) or after it was revealed. `security definer` so that the policy
-- does not depend on what the caller may read in `events`.
create function public.can_read_quiz_question(
  target_event_id uuid,
  question_position integer,
  question_status text,
  question_revealed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_host(target_event_id)
    or (
      public.is_member(target_event_id)
      and question_status = 'approved'
      and (
        question_revealed_at is not null
        or exists (
          select 1
          from public.events e
          where e.id = target_event_id
            and e.current_module = 'quiz'
            and e.current_step = question_position
            and e.phase in ('open', 'revealed')
        )
      )
    );
$$;

-- Whether the caller may read the key of this question: the host always,
-- other members once the question has been revealed.
create function public.can_read_quiz_key(target_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quiz_questions q
    where q.id = target_question_id
      and (
        public.is_host(q.event_id)
        or (
          public.is_member(q.event_id)
          and q.status = 'approved'
          and q.revealed_at is not null
        )
      )
  );
$$;

revoke execute on function public.can_read_quiz_question(
  uuid, integer, text, timestamptz
) from public, anon;
revoke execute on function public.can_read_quiz_key(uuid) from public, anon;
grant execute on function public.can_read_quiz_question(
  uuid, integer, text, timestamptz
) to authenticated;
grant execute on function public.can_read_quiz_key(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

-- Take back the default privileges, then grant only reading. No client
-- writes either table: questions and keys are written by host-actions with
-- the service role.
revoke all on public.quiz_questions from anon, authenticated;
revoke all on public.quiz_answer_keys from anon, authenticated;

grant select on public.quiz_questions to authenticated;
alter table public.quiz_questions enable row level security;

create policy "Members can read the questions they may see"
  on public.quiz_questions for select
  to authenticated
  using (
    public.can_read_quiz_question(event_id, position, status, revealed_at)
  );

grant select on public.quiz_answer_keys to authenticated;
alter table public.quiz_answer_keys enable row level security;

create policy "Members can read the keys they may see"
  on public.quiz_answer_keys for select
  to authenticated
  using (public.can_read_quiz_key(question_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Views follow a question being shown or revealed through the questions.
alter publication supabase_realtime add table public.quiz_questions;

-- ---------------------------------------------------------------------------
-- create_event with quiz questions
-- ---------------------------------------------------------------------------

drop function public.create_event(uuid, text, text, text, text[], jsonb, text);

-- As before, plus `quiz`: a JSON array of `{ text, options, correct }`,
-- already validated by host-actions with the shared quiz schema, in the order
-- chosen. Each is stored as an approved question with its key, at the
-- positions 0, 1, 2, ... in the same transaction as the event.
create function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text,
  quiz jsonb default '[]'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
  violated_constraint text;
begin
  begin
    insert into public.events (code, niche, language, enabled_modules, party)
    values (
      create_event.code,
      create_event.niche,
      create_event.language,
      create_event.enabled_modules,
      create_event.party
    )
    returning id into new_event_id;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'events_code_key' then
      return null;
    end if;
    raise;
  end;

  insert into private.event_secrets (event_id, admin_key_hash)
  values (new_event_id, create_event.admin_key_hash);

  insert into public.members (event_id, user_id, role)
  values (new_event_id, caller, 'host');

  with inserted as (
    insert into public.quiz_questions (event_id, position, text, options)
    select
      new_event_id,
      (q.ordinality - 1)::integer,
      q.value ->> 'text',
      array(
        select o.value
        from pg_catalog.jsonb_array_elements_text(q.value -> 'options')
          with ordinality as o(value, ordinality)
        order by o.ordinality
      )
    from pg_catalog.jsonb_array_elements(create_event.quiz)
      with ordinality as q(value, ordinality)
    returning id, position
  )
  insert into public.quiz_answer_keys (question_id, correct)
  select i.id, (q.value ->> 'correct')::integer
  from inserted i
  join pg_catalog.jsonb_array_elements(create_event.quiz)
    with ordinality as q(value, ordinality)
    on i.position = q.ordinality - 1;

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb
) to service_role;
