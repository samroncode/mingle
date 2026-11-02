-- Error logging, spec #223, ticket #224: browser errors in one table.
--
-- Nobody reads or writes `client_errors` through the API. Browsers write only
-- through `log_client_error`; the owner reads the table in the Supabase
-- dashboard (service role). RLS is on with NO policies on purpose, like the
-- tables in `private`: the rows are server-only. Rows are removed by age
-- (14 days) in the nightly cleanup. `event_code` is plain text, not a foreign
-- key, so a log row never depends on an event and the 30-day rule still holds.

create table public.client_errors (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('error', 'rejection', 'render', 'handled')),
  area text not null,
  action text,
  error_code text,
  message text,
  stack text,
  route text,
  event_code text,
  app_version text,
  created_at timestamptz not null default pg_catalog.now()
);

create index client_errors_created_idx on public.client_errors (created_at);

revoke all on public.client_errors from public, anon, authenticated;
alter table public.client_errors enable row level security;

-- Writes one row. Answers a code, never raises to the caller:
--   'logged'        the row was stored
--   'invalid_kind'  `kind` is not error, rejection, render or handled
--   'rate_limited'  more than 20 rows in a minute from this user; nothing stored
--   'invalid'       no area, or not signed in
-- Every text is cut to a fixed length; `route` loses any query and fragment.
create function public.log_client_error(
  kind text,
  area text,
  action text default null,
  error_code text default null,
  message text default null,
  stack text default null,
  route text default null,
  event_code text default null,
  app_version text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  cleaned_area text :=
    pg_catalog.left(pg_catalog.btrim(coalesce(log_client_error.area, '')), 40);
begin
  if caller is null or cleaned_area = '' then
    return 'invalid';
  end if;
  if log_client_error.kind is null
    or log_client_error.kind not in ('error', 'rejection', 'render', 'handled')
  then
    return 'invalid_kind';
  end if;
  if not public.consume_rate_limit(caller, 'log_client_error', 20, 60) then
    return 'rate_limited';
  end if;

  insert into public.client_errors (
    kind, area, action, error_code, message, stack, route, event_code,
    app_version
  )
  values (
    log_client_error.kind,
    cleaned_area,
    pg_catalog.left(log_client_error.action, 60),
    pg_catalog.left(log_client_error.error_code, 60),
    pg_catalog.left(log_client_error.message, 300),
    pg_catalog.left(log_client_error.stack, 1000),
    pg_catalog.left(
      pg_catalog.split_part(
        pg_catalog.split_part(log_client_error.route, '#', 1), '?', 1
      ),
      200
    ),
    pg_catalog.left(log_client_error.event_code, 20),
    pg_catalog.left(log_client_error.app_version, 40)
  );
  return 'logged';
end;
$$;

revoke execute on function public.log_client_error(
  text, text, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.log_client_error(
  text, text, text, text, text, text, text, text, text
) to authenticated;

-- The nightly cleanup also deletes error rows older than 14 days.
create or replace function private.cleanup_expired()
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
  client_errors_deleted integer;
begin
  insert into private.retired_codes (code)
  select e.code
  from public.events e
  where e.expires_at <= now()
  on conflict (code) do nothing;
  get diagnostics codes_retired = row_count;

  with deleted as (
    delete from public.events e
    where e.expires_at <= now()
    returning e.id
  )
  select coalesce(array_agg(d.id), '{}') into expired_ids from deleted d;
  events_deleted := coalesce(cardinality(expired_ids), 0);

  delete from private.rate_limits r
  where r.window_start < now() - interval '1 day'
    or exists (
      select 1
      from pg_catalog.unnest(expired_ids) as x(id)
      where r.action like '%:' || x.id::text
    );
  get diagnostics rate_limits_deleted = row_count;

  delete from public.client_errors c
  where c.created_at < now() - interval '14 days';
  get diagnostics client_errors_deleted = row_count;

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
    'client_errors', client_errors_deleted,
    'users', users_deleted
  );
end;
$$;

revoke execute on function private.cleanup_expired()
  from public, anon, authenticated, service_role;
