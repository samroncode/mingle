-- Backend core, spec 2 (#10), ticket #18: the database calls behind the admin
-- key check and `claim_host`.
--
-- Like create_event, these live in `public` so host-actions can reach them
-- through the Data API with the service role, and only `service_role` may
-- execute them.

-- ---------------------------------------------------------------------------
-- The admin key check
-- ---------------------------------------------------------------------------

-- The event id and admin key hash for a code, or no row when the code is
-- unknown or the event has expired. host-actions compares the hash itself, in
-- constant time, and answers both cases with the same `not_authorized`.
create function public.event_admin_key_hash(code text)
returns table (event_id uuid, admin_key_hash text)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, s.admin_key_hash
  from public.events e
  join private.event_secrets s on s.event_id = e.id
  where e.code = event_admin_key_hash.code
    and e.expires_at > pg_catalog.now();
$$;

-- Whether `caller` already has `max_attempts` or more counted for `action`
-- in the current window of `window_seconds`. Counts nothing. host-actions
-- asks this before checking a key, and counts only failed checks with
-- consume_rate_limit, so a host who types the right key is never slowed down.
create function public.rate_limit_reached(
  caller uuid,
  action text,
  max_attempts integer,
  window_seconds integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.rate_limits r
    where r.user_id = caller
      and r.action = rate_limit_reached.action
      and r.window_start > pg_catalog.now()
        - pg_catalog.make_interval(secs => rate_limit_reached.window_seconds)
      and r.count >= rate_limit_reached.max_attempts
  );
$$;

-- ---------------------------------------------------------------------------
-- Claiming the host role
-- ---------------------------------------------------------------------------

-- Makes `caller` a host of the event. Idempotent: a host stays one row, and a
-- guest or TV of the event becomes host in their existing row. Hosts have no
-- display name (members_display_name_check), so a guest's name is cleared and
-- frees it for other guests. Called by host-actions only after the admin key
-- check passed. Returns false when the event has expired since that check.
create function public.claim_host(caller uuid, target_event_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.events e
    where e.id = claim_host.target_event_id and e.expires_at > pg_catalog.now()
  ) then
    return false;
  end if;

  insert into public.members (event_id, user_id, role)
  values (claim_host.target_event_id, caller, 'host')
  on conflict (event_id, user_id) do update
  set role = 'host', display_name = null;

  return true;
end;
$$;

revoke execute on function public.event_admin_key_hash(text)
  from public, anon, authenticated;
revoke execute on function public.rate_limit_reached(uuid, text, integer, integer)
  from public, anon, authenticated;
revoke execute on function public.claim_host(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.event_admin_key_hash(text) to service_role;
grant execute on function public.rate_limit_reached(uuid, text, integer, integer)
  to service_role;
grant execute on function public.claim_host(uuid, uuid) to service_role;
