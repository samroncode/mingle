-- Cleanup of expired events, spec #83, ticket #86: the nightly job
-- (decision 2026-10-22, cleanup of expired events).
--
-- `private.cleanup_expired()` deletes every event whose retention is up and
-- everything that belongs to it, plus counters and logins nobody needs any
-- more. pg_cron runs it every night at 03:00 UTC.

-- ---------------------------------------------------------------------------
-- The cleanup function
-- ---------------------------------------------------------------------------

-- One function call is one transaction: if any step fails, nothing is deleted.
-- Returns how many rows each step handled, which pg_cron keeps in
-- `cron.job_run_details`. A second run right after finds nothing: all zeros.
--
-- Server-only: executable by no client role, and `private` is not exposed
-- through the API either. pg_cron and the database owner run it.
create function private.cleanup_expired()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  expired_ids uuid[];
  events_deleted integer;
  codes_retired integer;
  rate_limits_deleted integer;
  users_deleted integer;
begin
  -- 1. Retire the codes first, so a code is never free while its event is gone.
  insert into private.retired_codes (code)
  select e.code
  from public.events e
  where e.expires_at <= now()
  on conflict (code) do nothing;
  get diagnostics codes_retired = row_count;

  -- 2. Delete the events. Everything that belongs to them goes by cascade.
  with deleted as (
    delete from public.events e
    where e.expires_at <= now()
    returning e.id
  )
  select coalesce(array_agg(d.id), '{}') into expired_ids from deleted d;
  events_deleted := coalesce(cardinality(expired_ids), 0);

  -- 3. Rate-limit counters: those naming a deleted event (`action:<event id>`)
  -- and every one whose window started more than a day ago (every limit has a
  -- window of 10 minutes or less).
  delete from private.rate_limits r
  where r.window_start < now() - interval '1 day'
    or exists (
      select 1
      from pg_catalog.unnest(expired_ids) as x(id)
      where r.action like '%:' || x.id::text
    );
  get diagnostics rate_limits_deleted = row_count;

  -- 4. Anonymous logins in no event whose latest sign-in, session refresh or
  -- creation is older than the retention. Deleting a login also removes its
  -- sessions and any counters left (on delete cascade).
  delete from auth.users u
  where u.is_anonymous
    and not exists (
      select 1 from public.members m where m.user_id = u.id
    )
    and greatest(
      u.created_at,
      u.last_sign_in_at,
      (
        select max(greatest(s.created_at, s.updated_at, s.refreshed_at))
        from auth.sessions s
        where s.user_id = u.id
      )
    ) < now() - private.event_retention();
  get diagnostics users_deleted = row_count;

  return pg_catalog.jsonb_build_object(
    'events', events_deleted,
    'codes_retired', codes_retired,
    'rate_limits', rate_limits_deleted,
    'users', users_deleted
  );
end;
$$;

revoke execute on function private.cleanup_expired()
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The nightly job
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

-- Scheduling under an existing name replaces that job, so re-running the
-- migration never creates a second one.
select cron.schedule(
  'cleanup-expired-events',
  '0 3 * * *',
  'select private.cleanup_expired()'
);
