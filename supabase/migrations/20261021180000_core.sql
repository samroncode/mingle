-- Backend core, spec 1 (#9): events, members, the private schema, the helper
-- functions RLS uses, and the join RPCs.
--
-- Security lives here, not in the UI. Every client (guest, TV, host) talks to
-- these tables straight from the browser, so anything allowed below is
-- something anyone with devtools can do.

-- ---------------------------------------------------------------------------
-- Constants
-- ---------------------------------------------------------------------------

-- Server-only objects. `private` is not in `api.schemas` (supabase/config.toml)
-- so the Data API never exposes it, and clients get no privileges on it.
create schema private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- EVENT_RETENTION: how long an event and its data live after creation
-- (decision 2026-10-21, open question E).
create function private.event_retention()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '30 days' $$;

revoke execute on function private.event_retention() from public;
grant execute on function private.event_retention() to service_role;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.events (
  id uuid primary key default gen_random_uuid(),
  -- 6 characters without look-alikes: no 0/O and no 1/I/L.
  code text not null unique
    check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$'),

  -- Setup. Only the shape is checked here; host-actions validates the values
  -- against the niche and module registries.
  niche text not null check (niche ~ '^[a-z][a-z0-9_-]{0,31}$'),
  language text not null check (language in ('sv', 'en')),
  enabled_modules text[] not null default '{}'
    check (array_position(enabled_modules, null) is null),

  -- Party-screen content, host-written or host-approved.
  party jsonb not null default '{}' check (jsonb_typeof(party) = 'object'),

  -- Flow state (CLAUDE.md principle 1).
  status text not null default 'lobby'
    check (status in ('lobby', 'live', 'ended')),
  current_module text,
  current_step integer not null default 0 check (current_step >= 0),
  phase text not null default 'idle'
    check (phase in ('idle', 'open', 'revealed')),

  -- Lifecycle. Both defaults read the same transaction time, so an event
  -- expires exactly EVENT_RETENTION after it was created.
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + private.event_retention())
);

create table public.members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('host', 'guest', 'tv')),
  -- The only personal data Mingle stores. Guests must have one; hosts and
  -- TVs have none. Trimmed by the trigger below before this check runs.
  display_name text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id),
  constraint members_display_name_check check (
    (role = 'guest' and display_name is not null
      and char_length(display_name) between 1 and 30)
    or (role <> 'guest' and display_name is null)
  )
);

-- Guest names are unique per event, ignoring case. The data layer maps a
-- violation of this index to `name_taken`.
create unique index members_guest_name_key
  on public.members (event_id, lower(display_name))
  where role = 'guest';

-- Trims surrounding whitespace from display names on every insert and update,
-- so the length check and the uniqueness index see the trimmed name.
create function private.trim_display_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.display_name := pg_catalog.regexp_replace(
    new.display_name, '^\s+|\s+$', '', 'g'
  );
  return new;
end;
$$;

revoke execute on function private.trim_display_name() from public;

create trigger members_trim_display_name
  before insert or update of display_name on public.members
  for each row execute function private.trim_display_name();

-- Counters for throttling, per user and action.
--
-- RLS is on with NO policies, and clients have no grants on `private`. That
-- is intentional: these rows are server-only (decision 2026-10-20), so the
-- "a table without policies is a bug" rule does not apply here.
create table private.rate_limits (
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  window_start timestamptz not null default now(),
  count integer not null default 0 check (count >= 0),
  primary key (user_id, action)
);

alter table private.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Helper functions for policies
-- ---------------------------------------------------------------------------

-- `security definer` so that policies on `members` can check membership
-- without recursing into the policies on `members`. An expired event counts as
-- no membership, so its data is unreachable before cleanup deletes it.
create function public.is_member(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.events e on e.id = m.event_id
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and e.expires_at > pg_catalog.now()
  );
$$;

create function public.is_host(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    join public.events e on e.id = m.event_id
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'host'
      and e.expires_at > pg_catalog.now()
  );
$$;

revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_host(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_host(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

-- Supabase grants every privilege on new public tables to the client roles by
-- default. Take them all back, then grant only what the policies below need.
revoke all on public.events from anon, authenticated;
revoke all on public.members from anon, authenticated;

-- events: members read their event. No client writes; creation and every
-- flow change go through host-actions with the service role.
grant select on public.events to authenticated;
alter table public.events enable row level security;

create policy "Members can read their event"
  on public.events for select
  to authenticated
  using (public.is_member(id));

-- members: members of an event read each other. No client insert (the join
-- RPCs do it) and no client delete.
grant select on public.members to authenticated;
alter table public.members enable row level security;

create policy "Members can read the members of their event"
  on public.members for select
  to authenticated
  using (public.is_member(event_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.events, public.members;

-- ---------------------------------------------------------------------------
-- Join RPCs
-- ---------------------------------------------------------------------------

-- What both join RPCs return: the event id on success, otherwise an error code
-- (`not_found`, `ended`, `name_taken`, `invalid_name`, `rate_limited`) that
-- the UI maps to an i18n key. Errors are returned, not raised, so that a
-- failed attempt can still be counted for throttling.
create type public.join_result as (event_id uuid, error text);

-- Finds a joinable event by code. Codes are compared in upper case with
-- surrounding whitespace removed, since guests type them by hand. An expired
-- event is treated as unknown.
create function private.find_event_by_code(code text)
returns public.events
language sql
stable
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.code = pg_catalog.upper(pg_catalog.btrim(find_event_by_code.code))
    and e.expires_at > pg_catalog.now();
$$;

revoke execute on function private.find_event_by_code(text) from public;

-- Throttling against code guessing. Every join attempt with an unknown or
-- expired code counts as a failure for the caller, shared by join_event and
-- join_tv. After JOIN_FAILURE_LIMIT failures within JOIN_FAILURE_WINDOW, both
-- RPCs answer `rate_limited` to that user, even for a valid code, until the
-- window has passed. Supabase also limits anonymous sign-ins per IP, which caps
-- how many fresh users an attacker can create.

-- JOIN_FAILURE_LIMIT
create function private.join_failure_limit()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

-- JOIN_FAILURE_WINDOW
create function private.join_failure_window()
returns interval
language sql
immutable
set search_path = ''
as $$ select interval '1 minute' $$;

create function private.join_is_throttled(caller uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from private.rate_limits r
    where r.user_id = caller
      and r.action = 'join'
      and r.count >= private.join_failure_limit()
      and r.window_start > pg_catalog.now() - private.join_failure_window()
  );
$$;

-- Counts one failure. A failure after the window has passed starts a new one.
create function private.record_join_failure(caller uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  insert into private.rate_limits as r (user_id, action, window_start, count)
  values (caller, 'join', pg_catalog.now(), 1)
  on conflict (user_id, action) do update set
    window_start = case
      when r.window_start <= pg_catalog.now() - private.join_failure_window()
        then pg_catalog.now()
      else r.window_start
    end,
    count = case
      when r.window_start <= pg_catalog.now() - private.join_failure_window()
        then 1
      else r.count + 1
    end;
$$;

revoke execute on function private.join_failure_limit() from public;
revoke execute on function private.join_failure_window() from public;
revoke execute on function private.join_is_throttled(uuid) from public;
revoke execute on function private.record_join_failure(uuid) from public;

-- Joins the event with this code as a guest. Calling again from the same
-- session returns the same event id and changes nothing, so a guest keeps
-- their name and a host or TV can't turn into a guest.
create function public.join_event(code text, display_name text)
returns public.join_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.events;
  clean_name text;
  violated text;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if private.join_is_throttled(caller) then
    return row(null, 'rate_limited')::public.join_result;
  end if;

  target := private.find_event_by_code(join_event.code);
  if target.id is null then
    perform private.record_join_failure(caller);
    return row(null, 'not_found')::public.join_result;
  end if;
  if target.status = 'ended' then
    return row(null, 'ended')::public.join_result;
  end if;

  if exists (
    select 1 from public.members m
    where m.event_id = target.id and m.user_id = caller
  ) then
    return row(target.id, null)::public.join_result;
  end if;

  clean_name := pg_catalog.regexp_replace(
    coalesce(join_event.display_name, ''), '^\s+|\s+$', '', 'g'
  );
  if pg_catalog.char_length(clean_name) not between 1 and 30 then
    return row(null, 'invalid_name')::public.join_result;
  end if;

  begin
    insert into public.members (event_id, user_id, role, display_name)
    values (target.id, caller, 'guest', clean_name);
  exception when unique_violation then
    get stacked diagnostics violated = constraint_name;
    if violated = 'members_guest_name_key' then
      return row(null, 'name_taken')::public.join_result;
    end if;
    -- The same session joined at the same moment in another request.
  end;

  return row(target.id, null)::public.join_result;
end;
$$;

-- Joins the event with this code as its TV. Idempotent like join_event; a
-- host or guest of the event stays what they were.
create function public.join_tv(code text)
returns public.join_result
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.events;
begin
  if caller is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  if private.join_is_throttled(caller) then
    return row(null, 'rate_limited')::public.join_result;
  end if;

  target := private.find_event_by_code(join_tv.code);
  if target.id is null then
    perform private.record_join_failure(caller);
    return row(null, 'not_found')::public.join_result;
  end if;
  if target.status = 'ended' then
    return row(null, 'ended')::public.join_result;
  end if;

  insert into public.members (event_id, user_id, role)
  values (target.id, caller, 'tv')
  on conflict (event_id, user_id) do nothing;

  return row(target.id, null)::public.join_result;
end;
$$;

revoke execute on function public.join_event(text, text) from public, anon;
revoke execute on function public.join_tv(text) from public, anon;
grant execute on function public.join_event(text, text) to authenticated;
grant execute on function public.join_tv(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guests rename themselves
-- ---------------------------------------------------------------------------

-- A guest may change only the display_name column of their own row. The
-- column grant stops changes to role, event and user; the policy stops
-- changes to anyone else's row and to host and TV rows. The trigger, check and
-- unique index above apply the same name rules as join_event.
grant update (display_name) on public.members to authenticated;

create policy "Guests can rename themselves"
  on public.members for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and role = 'guest'
    and public.is_member(event_id)
  )
  with check (
    user_id = (select auth.uid())
    and role = 'guest'
    and public.is_member(event_id)
  );
