-- Pizza admin page (/pizza/admin): the owner reads and manages pizza orders
-- from a phone through a secret link, like the host link of an event.
--
-- The key sits in the link's fragment (`#key=…`), so it never reaches a server
-- log. Only its SHA-256 hash is stored, in `private.pizza_admin` (server-only:
-- RLS on, no policies, no client grants). To change the key, replace that row
-- in the Supabase SQL editor. `pizza_orders` itself stays closed to every API
-- role; the admin functions below are the only way in, and each one checks the
-- key first.

create table private.pizza_admin (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$')
);

revoke all on private.pizza_admin from public, anon, authenticated;
alter table private.pizza_admin enable row level security;

-- Only the hash of the first key is stored; the key itself is not in the repo.
insert into private.pizza_admin (key_hash)
values ('508283399f2a4335172819b5e7c806b6bb359d8f999242a4ea022cd619c98470');

alter table public.pizza_orders
  add column done boolean not null default false;

-- Says whether the caller may use the pizza admin functions:
--   'ok'            a signed-in caller with the right key
--   'rate_limited'  more than 120 calls in 10 minutes from this user
--   'forbidden'     not signed in, or a wrong or missing key (one answer for all)
create function private.check_pizza_admin(admin_key text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return 'forbidden';
  end if;
  if not public.consume_rate_limit(caller, 'pizza_admin', 120, 600) then
    return 'rate_limited';
  end if;
  if admin_key is null or not exists (
    select 1
    from private.pizza_admin a
    where a.key_hash = pg_catalog.encode(
      pg_catalog.sha256(pg_catalog.convert_to(admin_key, 'UTF8')),
      'hex'
    )
  ) then
    return 'forbidden';
  end if;
  return 'ok';
end;
$$;

revoke execute on function private.check_pizza_admin(text)
  from public, anon, authenticated, service_role;

-- The orders, newest first: { "orders": [...] } or { "error": "<code>" }.
create function public.pizza_admin_orders(admin_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  verdict text := private.check_pizza_admin(pizza_admin_orders.admin_key);
begin
  if verdict <> 'ok' then
    return pg_catalog.jsonb_build_object('error', verdict);
  end if;
  return pg_catalog.jsonb_build_object(
    'orders',
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'id', o.id,
            'name', o.name,
            'pizza', o.pizza,
            'note', o.note,
            'done', o.done,
            'created_at', o.created_at
          )
          order by o.created_at desc
        )
        from public.pizza_orders o
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Marks one order as ordered (or not). 'ok', 'not_found', 'forbidden' or
-- 'rate_limited'.
create function public.pizza_admin_set_done(
  admin_key text,
  order_id uuid,
  done boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  verdict text := private.check_pizza_admin(pizza_admin_set_done.admin_key);
begin
  if verdict <> 'ok' then
    return verdict;
  end if;
  update public.pizza_orders o
  set done = pizza_admin_set_done.done
  where o.id = pizza_admin_set_done.order_id;
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- Deletes one order. 'ok', 'not_found', 'forbidden' or 'rate_limited'.
create function public.pizza_admin_delete(admin_key text, order_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  verdict text := private.check_pizza_admin(pizza_admin_delete.admin_key);
begin
  if verdict <> 'ok' then
    return verdict;
  end if;
  delete from public.pizza_orders o
  where o.id = pizza_admin_delete.order_id;
  if not found then
    return 'not_found';
  end if;
  return 'ok';
end;
$$;

-- Deletes every order. 'ok', 'forbidden' or 'rate_limited'.
create function public.pizza_admin_clear(admin_key text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  verdict text := private.check_pizza_admin(pizza_admin_clear.admin_key);
begin
  if verdict <> 'ok' then
    return verdict;
  end if;
  -- `where true` because the API roles refuse a delete without a where clause.
  delete from public.pizza_orders o where true;
  return 'ok';
end;
$$;

revoke execute on function public.pizza_admin_orders(text)
  from public, anon;
revoke execute on function public.pizza_admin_set_done(text, uuid, boolean)
  from public, anon;
revoke execute on function public.pizza_admin_delete(text, uuid)
  from public, anon;
revoke execute on function public.pizza_admin_clear(text) from public, anon;
grant execute on function public.pizza_admin_orders(text) to authenticated;
grant execute on function public.pizza_admin_set_done(text, uuid, boolean)
  to authenticated;
grant execute on function public.pizza_admin_delete(text, uuid)
  to authenticated;
grant execute on function public.pizza_admin_clear(text) to authenticated;
