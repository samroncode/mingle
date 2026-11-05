-- The pizzeria's menu has no pizza numbers, so an order is a name, the pizza
-- and an optional note. Replaces the function from 20261105100000 (the old
-- signature with `pizza_number` is dropped).

drop function public.submit_pizza_order(text, text, text, text);

alter table public.pizza_orders drop column pizza_number;

-- Stores one order. Answers a code, never text:
--   'ok'            the order was stored
--   'invalid'       not signed in, or name or pizza is empty
--   'rate_limited'  more than 5 orders in an hour from this user; nothing stored
-- Every text is trimmed and cut to a fixed length.
create function public.submit_pizza_order(
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
  if not public.consume_rate_limit(caller, 'submit_pizza_order', 5, 3600) then
    return 'rate_limited';
  end if;

  insert into public.pizza_orders (name, pizza, note)
  values (cleaned_name, cleaned_pizza, cleaned_note);
  return 'ok';
end;
$$;

revoke execute on function public.submit_pizza_order(text, text, text)
  from public, anon;
grant execute on function public.submit_pizza_order(text, text, text)
  to authenticated;
