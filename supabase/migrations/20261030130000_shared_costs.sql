-- Shared costs spec (#175), ticket #176: the host enters their Swish number,
-- the name guests pay to, and the purchases with who shares each.
--
-- The Swish number is not party content: every member, the TV included, can
-- read the event row and its `party` JSON, so costs live in their own tables.
-- Only the host reads them, and nobody writes them directly: host-actions
-- checks the admin key, then writes with update_costs. Guests get no access
-- yet; a later ticket adds a function that answers a guest their own bill,
-- and only once the host has sent it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- One row per event; the row exists while shared costs are switched on. The
-- limits match CostsSchema in src/lib/schemas/costs.ts. The number is stored
-- normalised: country code, then the mobile number without its leading zero
-- (46701234567). `bill_sent_at` is null until the host sends the bill.
create table public.cost_settings (
  event_id uuid primary key references public.events (id) on delete cascade,
  payee_name text not null check (
    char_length(payee_name) between 1 and 40 and btrim(payee_name) <> ''
  ),
  swish_number text not null check (swish_number ~ '^46(70|72|73|76|79)[0-9]{7}$'),
  bill_sent_at timestamptz
);

-- A purchase is a position in the event's purchases (from 0). The price is in
-- whole kronor.
create table public.cost_purchases (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 0 and 49),
  name text not null check (
    char_length(name) between 1 and 40 and btrim(name) <> ''
  ),
  price_kr integer not null check (price_kr between 1 and 100000),
  unique (event_id, position)
);

-- Who shares a purchase. A guest's share is computed when it is read (the
-- price divided by the sharers who are not removed, rounded up), never
-- stored. `event_id` is here so that the policy needs no join.
create table public.cost_sharers (
  purchase_id uuid not null references public.cost_purchases (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null,
  primary key (purchase_id, user_id),
  foreign key (event_id, user_id)
    references public.members (event_id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

-- Take back the default privileges, then grant only reading. The policy lets
-- through the host of the event and nobody else: not a guest, not the TV.
revoke all on public.cost_settings, public.cost_purchases, public.cost_sharers
  from anon, authenticated;
grant select
  on public.cost_settings, public.cost_purchases, public.cost_sharers
  to authenticated;

alter table public.cost_settings enable row level security;
alter table public.cost_purchases enable row level security;
alter table public.cost_sharers enable row level security;

create policy "Hosts can read the cost settings of their event"
  on public.cost_settings for select
  to authenticated
  using (public.is_host(event_id));

create policy "Hosts can read the purchases of their event"
  on public.cost_purchases for select
  to authenticated
  using (public.is_host(event_id));

create policy "Hosts can read who shares the purchases of their event"
  on public.cost_sharers for select
  to authenticated
  using (public.is_host(event_id));

-- ---------------------------------------------------------------------------
-- update_costs
-- ---------------------------------------------------------------------------

-- Switches shared costs on, replacing the payee name, the Swish number and
-- the whole purchase list, or off. `costs` is
-- `{ payeeName, swishNumber, purchases: [{ name, price, sharers: [userId] }] }`
-- in the order chosen, or null to switch off, which deletes every cost row of
-- the event. Switching on again keeps `bill_sent_at`; the purchases are
-- replaced as a whole.
--
-- host-actions has validated the shape with the shared schema; the table
-- checks hold the limits here too.
--
-- Answers, changing nothing:
--   'not_found'   the event doesn't exist or has expired since the key check
--   'bad_sharer'  a purchase has no sharer, or a sharer isn't a current
--                 guest of the event (a host, a TV, a removed guest, a user
--                 of another event)
--   'invalid'     a name, price, number or the purchase count is outside the
--                 limits
-- and 'updated' once written.
--
-- Shared costs don't touch the event's flow, so this works for an ended
-- event too: people pay the next day. The event row is locked for share, so
-- the event can't be deleted meanwhile. Called by host-actions only.
create function public.update_costs(
  target_event_id uuid,
  costs jsonb
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  purchase jsonb;
  purchase_ordinality bigint;
  new_purchase_id uuid;
begin
  perform 1
  from public.events e
  where e.id = update_costs.target_event_id
    and e.expires_at > pg_catalog.now()
  for share;
  if not found then
    return 'not_found';
  end if;

  if update_costs.costs is null
    or pg_catalog.jsonb_typeof(update_costs.costs) = 'null' then
    delete from public.cost_purchases p
    where p.event_id = update_costs.target_event_id;
    delete from public.cost_settings s
    where s.event_id = update_costs.target_event_id;
    return 'updated';
  end if;

  begin
    if pg_catalog.jsonb_array_length(update_costs.costs -> 'purchases') > 50 then
      return 'invalid';
    end if;

    -- Every sharer must be a current guest, and every purchase needs one.
    if exists (
      select 1
      from pg_catalog.jsonb_array_elements(update_costs.costs -> 'purchases') p
      where pg_catalog.jsonb_array_length(p -> 'sharers') = 0
    ) or exists (
      select 1
      from pg_catalog.jsonb_array_elements(update_costs.costs -> 'purchases') p,
        pg_catalog.jsonb_array_elements_text(p -> 'sharers') s
      where not exists (
        select 1
        from public.members m
        where m.event_id = update_costs.target_event_id
          and m.user_id = s::uuid
          and m.role = 'guest'
          and m.removed_at is null
      )
    ) then
      return 'bad_sharer';
    end if;

    insert into public.cost_settings (event_id, payee_name, swish_number)
    values (
      update_costs.target_event_id,
      update_costs.costs ->> 'payeeName',
      update_costs.costs ->> 'swishNumber'
    )
    on conflict (event_id) do update
    set payee_name = excluded.payee_name,
        swish_number = excluded.swish_number;

    delete from public.cost_purchases p
    where p.event_id = update_costs.target_event_id;

    for purchase, purchase_ordinality in
      select p.value, p.ordinality
      from pg_catalog.jsonb_array_elements(update_costs.costs -> 'purchases')
        with ordinality as p(value, ordinality)
    loop
      insert into public.cost_purchases (event_id, position, name, price_kr)
      values (
        update_costs.target_event_id,
        (purchase_ordinality - 1)::integer,
        purchase ->> 'name',
        (purchase ->> 'price')::integer
      )
      returning id into new_purchase_id;

      insert into public.cost_sharers (purchase_id, event_id, user_id)
      select new_purchase_id, update_costs.target_event_id, s::uuid
      from pg_catalog.jsonb_array_elements_text(purchase -> 'sharers') s
      on conflict do nothing;
    end loop;
  exception when check_violation or not_null_violation
    or invalid_text_representation or invalid_parameter_value
    or numeric_value_out_of_range then
    -- Rolls back this block, so nothing is half written.
    return 'invalid';
  end;

  return 'updated';
end;
$$;

revoke execute on function public.update_costs(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_costs(uuid, jsonb)
  to service_role;
