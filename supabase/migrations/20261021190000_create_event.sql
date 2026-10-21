-- Backend core, spec 2 (#10), ticket #17: the admin key hash and the two
-- database calls the host-actions Edge Function needs for `create_event`.
--
-- host-actions reaches the database with the service role through the Data
-- API, which only exposes `public`. So the functions below live in `public`,
-- but only `service_role` may execute them; no client role can.

-- ---------------------------------------------------------------------------
-- Admin key hashes
-- ---------------------------------------------------------------------------

-- The SHA-256 of each event's admin key, as lowercase hex. The key itself is
-- never stored: host-actions hashes it before it reaches the database.
--
-- RLS is on with NO policies, and clients have no grants on `private`. That
-- is intentional: these rows are server-only (decision 2026-10-20), so the
-- "a table without policies is a bug" rule does not apply here.
create table private.event_secrets (
  event_id uuid primary key references public.events (id) on delete cascade,
  admin_key_hash text not null check (admin_key_hash ~ '^[0-9a-f]{64}$')
);

alter table private.event_secrets enable row level security;

-- ---------------------------------------------------------------------------
-- Rate limits for host-actions
-- ---------------------------------------------------------------------------

-- Counts one attempt at `action` by `caller` and says whether it is within
-- the limit: at most `max_attempts` per fixed window of `window_seconds`,
-- starting at the first attempt. The upsert locks the counter row, so
-- parallel requests from one user are counted one at a time.
create function public.consume_rate_limit(
  caller uuid,
  action text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  window_length interval :=
    pg_catalog.make_interval(secs => consume_rate_limit.window_seconds);
  attempts integer;
begin
  insert into private.rate_limits as r (user_id, action, window_start, count)
  values (caller, consume_rate_limit.action, pg_catalog.now(), 1)
  on conflict on constraint rate_limits_pkey do update
  set window_start = case
        when r.window_start > pg_catalog.now() - window_length
          then r.window_start
        else pg_catalog.now()
      end,
      count = case
        when r.window_start > pg_catalog.now() - window_length
          then r.count + 1
        else 1
      end
  returning r.count into attempts;

  return attempts <= max_attempts;
end;
$$;

-- ---------------------------------------------------------------------------
-- Creating an event
-- ---------------------------------------------------------------------------

-- Creates the event with the given code, stores its admin key hash and makes
-- `caller` its host, all in one transaction. The values were validated by
-- host-actions against the niche and module registries; the table checks
-- only their shape. Returns the event id, or null when the code is already
-- taken, so host-actions can retry with a new one.
create function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text
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

  return new_event_id;
end;
$$;

-- Supabase grants execute on new public functions to every API role by
-- default. Only the service role (inside host-actions) may call these.
revoke execute on function public.consume_rate_limit(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.create_event(uuid, text, text, text, text[], jsonb, text)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(uuid, text, integer, integer)
  to service_role;
grant execute on function public.create_event(uuid, text, text, text, text[], jsonb, text)
  to service_role;
