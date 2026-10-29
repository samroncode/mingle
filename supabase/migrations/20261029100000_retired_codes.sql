-- Cleanup of expired events, spec #83, ticket #85: codes are never reused
-- (decision 2026-10-22, cleanup of expired events).
--
-- The nightly cleanup (#86) deletes expired events and records their codes
-- here first. `create_event` treats a retired code like a taken one, so an
-- old QR code, host link or TV address can never open a new event.

-- ---------------------------------------------------------------------------
-- Retired codes
-- ---------------------------------------------------------------------------

-- The code only, with no link to the deleted event, so nothing about it is
-- kept. Same shape check as `events.code`.
--
-- RLS is on with NO policies, and clients have no grants on `private`, like
-- the other `private` tables (decision 2026-10-20): server-only on purpose.
create table private.retired_codes (
  code text primary key
    check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),
  retired_at timestamptz not null default now()
);

alter table private.retired_codes enable row level security;

revoke all on table private.retired_codes from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_event skips retired codes
-- ---------------------------------------------------------------------------

-- As before, but a code in `private.retired_codes` answers null like a taken
-- one, and nothing is created, so host-actions retries with a new code.
create or replace function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text,
  quiz jsonb default '[]',
  awards jsonb default '[]'
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

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb
) to service_role;
