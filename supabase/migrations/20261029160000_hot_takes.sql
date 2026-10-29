-- Hot takes spec (#67), ticket #70: the hot takes of an event, and
-- `create_event` taking the picked hot takes.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- The limits match HotTakeSchema in src/lib/schemas/hottakes.ts. A hot take
-- is a position in the event's hot takes (from 0), so the flow state
-- (`current_step`) refers to it by that position.
create table public.hot_takes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 0 and 19),
  text text not null check (
    char_length(text) between 1 and 120 and btrim(text) <> ''
  ),
  -- Only `approved` hot takes are ever shown to guests or on the TV;
  -- `draft` is for AI suggestions later.
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  -- Null until the hot take is revealed; then its result is known.
  revealed_at timestamptz,
  -- How many guests have answered, kept by the database so that "7 of 12
  -- answered" needs no access to the answers.
  answer_count integer not null default 0 check (answer_count >= 0),
  unique (event_id, position)
);

-- ---------------------------------------------------------------------------
-- Helper function for the policy
-- ---------------------------------------------------------------------------

-- Whether the caller may read this hot take. The host reads every hot take of
-- their event. Other members read an approved hot take only while the event
-- shows it (hot takes are on its position with the phase open or revealed)
-- or after it was revealed. `security definer` so that the policy does not
-- depend on what the caller may read in `events`.
create function public.can_read_hot_take(
  target_event_id uuid,
  take_position integer,
  take_status text,
  take_revealed_at timestamptz
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
      and take_status = 'approved'
      and (
        take_revealed_at is not null
        or exists (
          select 1
          from public.events e
          where e.id = target_event_id
            and e.current_module = 'hottakes'
            and e.current_step = take_position
            and e.phase in ('open', 'revealed')
        )
      )
    );
$$;

revoke execute on function public.can_read_hot_take(
  uuid, integer, text, timestamptz
) from public, anon;
grant execute on function public.can_read_hot_take(
  uuid, integer, text, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

-- Take back the default privileges, then grant only reading. No client
-- writes the table: hot takes are written by host-actions with the service
-- role.
revoke all on public.hot_takes from anon, authenticated;

grant select on public.hot_takes to authenticated;
alter table public.hot_takes enable row level security;

create policy "Members can read the hot takes they may see"
  on public.hot_takes for select
  to authenticated
  using (
    public.can_read_hot_take(event_id, position, status, revealed_at)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Views follow a hot take being shown, answered or revealed through it.
alter publication supabase_realtime add table public.hot_takes;

-- ---------------------------------------------------------------------------
-- create_event with hot takes
-- ---------------------------------------------------------------------------

drop function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb
);

-- As before (retired codes included), plus `hottakes`: a JSON array of
-- `{ text }`, already validated by host-actions with the shared hot takes
-- schema, in the order chosen. Each is stored as an approved hot take at the
-- positions 0, 1, 2, ... in the same transaction as the event.
create function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text,
  quiz jsonb default '[]',
  awards jsonb default '[]',
  hottakes jsonb default '[]'
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

    -- Checked after the insert, as its own statement, so it sees a code that
    -- the cleanup retired while the insert waited for that event's row to go.
    if exists (
      select 1 from private.retired_codes r where r.code = create_event.code
    ) then
      raise unique_violation using constraint = 'retired_codes_pkey';
    end if;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint in ('events_code_key', 'retired_codes_pkey') then
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

  insert into public.award_categories (event_id, position, text)
  select new_event_id, (a.ordinality - 1)::integer, a.value ->> 'text'
  from pg_catalog.jsonb_array_elements(create_event.awards)
    with ordinality as a(value, ordinality);

  insert into public.hot_takes (event_id, position, text)
  select new_event_id, (h.ordinality - 1)::integer, h.value ->> 'text'
  from pg_catalog.jsonb_array_elements(create_event.hottakes)
    with ordinality as h(value, ordinality);

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb
) to service_role;
