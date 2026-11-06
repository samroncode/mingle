-- Raises the pizza order limit from 5 to 12 per hour per user. Same signature and
-- grants as 20261105110000; only the limit and its comment change.

-- Stores one order. Answers a code, never text:
--   'ok'            the order was stored
--   'invalid'       not signed in, or name or pizza is empty
--   'rate_limited'  more than 12 orders in an hour from this user; nothing stored
-- Every text is trimmed and cut to a fixed length.
create or replace function public.submit_pizza_order(
  name text,
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
  cleaned_pizza text :=
    pg_catalog.left(pg_catalog.btrim(coalesce(submit_pizza_order.pizza, '')), 60);
  cleaned_note text :=
    nullif(pg_catalog.left(pg_catalog.btrim(coalesce(submit_pizza_order.note, '')), 100), '');
begin
  if caller is null or cleaned_name = '' or cleaned_pizza = '' then
    return 'invalid';
  end if;
  if not public.consume_rate_limit(caller, 'submit_pizza_order', 12, 3600) then
    return 'rate_limited';
  end if;

  insert into public.pizza_orders (name, pizza, note)
  values (cleaned_name, cleaned_pizza, cleaned_note);
  return 'ok';
end;
$$;
