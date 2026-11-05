-- Pizza page (/pizza): a standalone order list, not tied to any event.
--
-- Nobody reads or writes `pizza_orders` through the API. People write only
-- through `submit_pizza_order`; the owner reads the table in the Supabase
-- dashboard (service role). RLS is on with NO policies on purpose, like
-- `client_errors`: the rows are server-only. The nightly cleanup deletes
-- orders older than 30 days. Stored: a display name, a pizza number and name,
-- and an optional note. Nothing else.

create table public.pizza_orders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  pizza_number text not null check (char_length(pizza_number) between 1 and 10),
  pizza text not null check (char_length(pizza) between 1 and 60),
  note text check (note is null or char_length(note) <= 100),
  created_at timestamptz not null default pg_catalog.now()
);

create index pizza_orders_created_idx on public.pizza_orders (created_at);

revoke all on public.pizza_orders from public, anon, authenticated;
alter table public.pizza_orders enable row level security;

-- Stores one order. Answers a code, never text:
--   'ok'            the order was stored
--   'invalid'       not signed in, or name, pizza number or pizza is empty
--   'rate_limited'  more than 5 orders in an hour from this user; nothing stored
-- Every text is trimmed and cut to a fixed length.
create function public.submit_pizza_order(
  name text,
  pizza_number text,
  pizza text,
  note text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  cleaned_name text :=
    pg_catalog.left(pg_catalog.btrim(coalesce(submit_pizza_order.name, '')), 40);
  cleaned_number text := pg_catalog.left(
    pg_catalog.btrim(coalesce(submit_pizza_order.pizza_number, '')), 10);
  cleaned_pizza text :=
    pg_catalog.left(pg_catalog.btrim(coalesce(submit_pizza_order.pizza, '')), 60);
  cleaned_note text :=
    nullif(pg_catalog.left(pg_catalog.btrim(coalesce(submit_pizza_order.note, '')), 100), '');
begin
  if caller is null
    or cleaned_name = '' or cleaned_number = '' or cleaned_pizza = ''
  then
    return 'invalid';
  end if;
  if not public.consume_rate_limit(caller, 'submit_pizza_order', 5, 3600) then
    return 'rate_limited';
  end if;

  insert into public.pizza_orders (name, pizza_number, pizza, note)
  values (cleaned_name, cleaned_number, cleaned_pizza, cleaned_note);
  return 'ok';
end;
$$;

revoke execute on function public.submit_pizza_order(text, text, text, text)
  from public, anon;
grant execute on function public.submit_pizza_order(text, text, text, text)
  to authenticated;

-- The nightly cleanup also deletes pizza orders older than the retention period.
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

  -- Pizza orders (spec: standalone /pizza page) live 30 days.
  delete from public.pizza_orders o
  where o.created_at < now() - private.event_retention();

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
