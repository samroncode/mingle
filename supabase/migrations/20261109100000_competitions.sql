-- Competitions spec (#262), ticket #263: the host sets up competitions
-- ("Ping pong", "Darts") as a fourth activity. No matches yet; later tickets
-- add them.
--
-- Members read the competitions of their event. Nobody writes the table from
-- the client: host-actions checks the admin key, then calls the functions
-- below with the service role.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- The limits match CompetitionNameSchema in src/lib/schemas/competitions.ts.
-- A competition has a position in the event's list (from 0, at most 5 of
-- them) and a host-written name that is never translated.
create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 0 and 4),
  name text not null check (
    char_length(name) between 1 and 40 and btrim(name) <> ''
  ),
  created_at timestamptz not null default now(),
  -- Deferrable so that a reorder can swap positions in one statement.
  constraint competitions_position_key
    unique (event_id, position) deferrable initially immediate
);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.competitions from anon, authenticated;

grant select on public.competitions to authenticated;
alter table public.competitions enable row level security;

create policy "Members can read the competitions of their event"
  on public.competitions for select
  to authenticated
  using (public.is_member(event_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Views follow competitions being added, renamed, removed and reordered.
alter publication supabase_realtime add table public.competitions;

-- ---------------------------------------------------------------------------
-- Host functions
-- ---------------------------------------------------------------------------

-- Locks the event row and answers why competitions can't be changed, or null
-- when they can:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'disabled'   the event has Competitions switched off
-- The lock makes the count and position checks in the callers safe against a
-- parallel call for the same event.
create function private.lock_event_for_competitions(target_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.events%rowtype;
begin
  select e.* into target
  from public.events e
  where e.id = lock_event_for_competitions.target_event_id
    and e.expires_at > pg_catalog.now()
  for update;
  if not found then
    return 'not_found';
  end if;
  if target.status = 'ended' then
    return 'ended';
  end if;
  if not ('competitions' = any (target.enabled_modules)) then
    return 'disabled';
  end if;
  return null;
end;
$$;

revoke execute on function private.lock_event_for_competitions(uuid)
  from public, anon, authenticated;
grant execute on function private.lock_event_for_competitions(uuid)
  to service_role;

-- Adds a competition last in the list. host-actions has already trimmed the
-- name with the shared schema; it is cleaned here too, and must be 1 to 40
-- characters afterwards.
--
-- Answers, changing nothing: 'not_found', 'ended', 'disabled' (see above),
-- 'invalid_name' and 'too_many' (the event already has 5). 'created' once
-- written. Called by host-actions only.
create function public.create_competition(
  target_event_id uuid,
  competition_name text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  cleaned text;
  existing integer;
begin
  refusal := private.lock_event_for_competitions(
    create_competition.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  cleaned := private.clean_display_name(create_competition.competition_name);
  if cleaned is null or char_length(cleaned) not between 1 and 40 then
    return 'invalid_name';
  end if;

  select count(*)::integer into existing
  from public.competitions c
  where c.event_id = create_competition.target_event_id;
  if existing >= 5 then
    return 'too_many';
  end if;

  insert into public.competitions (event_id, position, name)
  values (create_competition.target_event_id, existing, cleaned);

  return 'created';
end;
$$;

revoke execute on function public.create_competition(uuid, text)
  from public, anon, authenticated;
grant execute on function public.create_competition(uuid, text)
  to service_role;

-- Renames a competition of the event. Answers, changing nothing:
-- 'not_found', 'ended', 'disabled', 'invalid_name' and 'unknown' (no such
-- competition in this event). 'renamed' once written.
create function public.rename_competition(
  target_event_id uuid,
  competition_id uuid,
  competition_name text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  cleaned text;
begin
  refusal := private.lock_event_for_competitions(
    rename_competition.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  cleaned := private.clean_display_name(rename_competition.competition_name);
  if cleaned is null or char_length(cleaned) not between 1 and 40 then
    return 'invalid_name';
  end if;

  update public.competitions c
  set name = cleaned
  where c.id = rename_competition.competition_id
    and c.event_id = rename_competition.target_event_id;
  if not found then
    return 'unknown';
  end if;

  return 'renamed';
end;
$$;

revoke execute on function public.rename_competition(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.rename_competition(uuid, uuid, text)
  to service_role;

-- Removes a competition of the event; the ones after it move up so the
-- positions stay 0, 1, 2, ... Answers, changing nothing: 'not_found',
-- 'ended', 'disabled' and 'unknown'. 'deleted' once written.
create function public.delete_competition(
  target_event_id uuid,
  competition_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  removed_position integer;
begin
  refusal := private.lock_event_for_competitions(
    delete_competition.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  delete from public.competitions c
  where c.id = delete_competition.competition_id
    and c.event_id = delete_competition.target_event_id
  returning c.position into removed_position;
  if not found then
    return 'unknown';
  end if;

  set constraints public.competitions_position_key deferred;
  update public.competitions c
  set position = c.position - 1
  where c.event_id = delete_competition.target_event_id
    and c.position > removed_position;

  return 'deleted';
end;
$$;

revoke execute on function public.delete_competition(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_competition(uuid, uuid)
  to service_role;

-- Puts the event's competitions in the order of `competition_ids`, which
-- must list every competition of the event exactly once. Answers, changing
-- nothing: 'not_found', 'ended', 'disabled' and 'mismatch' (an id that isn't
-- the event's, a repeated id, or one missing). 'reordered' once written.
create function public.reorder_competitions(
  target_event_id uuid,
  competition_ids uuid[]
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  existing integer;
  matching integer;
begin
  refusal := private.lock_event_for_competitions(
    reorder_competitions.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  select count(*)::integer into existing
  from public.competitions c
  where c.event_id = reorder_competitions.target_event_id;

  select count(distinct c.id)::integer into matching
  from public.competitions c
  where c.event_id = reorder_competitions.target_event_id
    and c.id = any (reorder_competitions.competition_ids);

  if pg_catalog.cardinality(reorder_competitions.competition_ids) <> existing
    or matching <> existing then
    return 'mismatch';
  end if;

  set constraints public.competitions_position_key deferred;
  update public.competitions c
  set position = (o.ordinality - 1)::integer
  from pg_catalog.unnest(reorder_competitions.competition_ids)
    with ordinality as o(id, ordinality)
  where c.id = o.id
    and c.event_id = reorder_competitions.target_event_id;

  return 'reordered';
end;
$$;

revoke execute on function public.reorder_competitions(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.reorder_competitions(uuid, uuid[])
  to service_role;

-- ---------------------------------------------------------------------------
-- create_event with competitions
-- ---------------------------------------------------------------------------

drop function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb, jsonb
);

-- As before (retired codes, quiz, awards, hot takes and costs included), plus
-- `competitions`: a JSON array of `{ name }`, already validated by
-- host-actions with the shared competitions schema (at most 5), in the order
-- chosen. Each is stored at the positions 0, 1, 2, ... in the same
-- transaction as the event.
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
  hottakes jsonb default '[]',
  costs jsonb default null,
  competitions jsonb default '[]'
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

  insert into public.competitions (event_id, position, name)
  select new_event_id, (c.ordinality - 1)::integer, c.value ->> 'name'
  from pg_catalog.jsonb_array_elements(create_event.competitions)
    with ordinality as c(value, ordinality);

  if create_event.costs is not null
    and pg_catalog.jsonb_typeof(create_event.costs) = 'object' then
    insert into public.cost_settings (event_id, payee_name, swish_number)
    values (
      new_event_id,
      create_event.costs ->> 'payeeName',
      create_event.costs ->> 'swishNumber'
    );

    insert into public.cost_purchases (event_id, position, name, price_kr)
    select
      new_event_id,
      (c.ordinality - 1)::integer,
      c.value ->> 'name',
      (c.value ->> 'price')::integer
    from pg_catalog.jsonb_array_elements(create_event.costs -> 'purchases')
      with ordinality as c(value, ordinality);
  end if;

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb, jsonb,
  jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb, jsonb,
  jsonb
) to service_role;
