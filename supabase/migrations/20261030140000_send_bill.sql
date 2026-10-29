-- Shared costs spec (#175), ticket #177: the host sends the bill, and each
-- guest reads their own share.
--
-- Until the host sends the bill, a guest can learn nothing about money. After
-- that, `my_bill` answers a guest their own lines and nothing about anyone
-- else. The Swish number is only inside that answer, never in a table a
-- guest can read.

-- ---------------------------------------------------------------------------
-- The live signal
-- ---------------------------------------------------------------------------

-- Guests and the TV can read the event row and follow it through Realtime,
-- but never the cost tables. This counter is the signal: it goes up when the
-- bill is sent or hidden, and when the costs change while the bill is sent.
-- A phone that sees it change reads `my_bill` again. It carries no money:
-- not an amount, not a name.
alter table public.events
  add column costs_version integer not null default 0;

-- ---------------------------------------------------------------------------
-- update_costs
-- ---------------------------------------------------------------------------

-- Same as in the shared costs migration, except that every change made while
-- the bill is sent (including switching costs off) also raises
-- `costs_version`, so the guests' phones read their bill again.
create or replace function public.update_costs(
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
    perform private.bump_costs_version(update_costs.target_event_id);
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

  perform private.bump_costs_version(update_costs.target_event_id);
  return 'updated';
end;
$$;

-- Raises the signal, but only while the bill is sent: before that, guests
-- have nothing to read again, and the counter shouldn't hint that the host
-- is working on costs.
create function private.bump_costs_version(target_event_id uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  update public.events e
  set costs_version = e.costs_version + 1
  where e.id = target_event_id
    and exists (
      select 1
      from public.cost_settings s
      where s.event_id = target_event_id
        and s.bill_sent_at is not null
    );
$$;

revoke execute on function private.bump_costs_version(uuid) from public;
grant execute on function private.bump_costs_version(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- set_bill_sent
-- ---------------------------------------------------------------------------

-- Sends the bill, or hides it again. Sending a bill that is sent keeps the
-- time it was first sent; hiding one that is hidden changes nothing. Either
-- way the answer is the state the bill is now in.
--
-- Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'costs_off'  shared costs aren't switched on, so there is no bill
-- and 'sent' or 'hidden' once written.
--
-- Works for an ended event too: people pay the next day. Called by
-- host-actions only.
create function public.set_bill_sent(
  target_event_id uuid,
  sent boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.events e
  where e.id = set_bill_sent.target_event_id
    and e.expires_at > pg_catalog.now()
  for no key update;
  if not found then
    return 'not_found';
  end if;

  update public.cost_settings s
  set bill_sent_at = case
    when set_bill_sent.sent then coalesce(s.bill_sent_at, pg_catalog.now())
    else null
  end
  where s.event_id = set_bill_sent.target_event_id;
  if not found then
    return 'costs_off';
  end if;

  -- Always raises the signal, also for the same state again: harmless.
  update public.events e
  set costs_version = e.costs_version + 1
  where e.id = set_bill_sent.target_event_id;

  return case when set_bill_sent.sent then 'sent' else 'hidden' end;
end;
$$;

revoke execute on function public.set_bill_sent(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_bill_sent(uuid, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- my_bill
-- ---------------------------------------------------------------------------

-- The calling guest's own bill, or null. It is null unless the caller is a
-- current guest of the event (not the host, not a TV, not a removed guest,
-- not a stranger) and the host has sent the bill. Otherwise:
--   { payeeName, swishNumber, total, lines: [{ name, share }] }
-- `lines` holds only the purchases the caller shares, in the host's order. A
-- share is the price divided by the sharers who are not removed, rounded up
-- to the next whole krona; `total` is the sum of the shares. Nothing about
-- another guest is ever in the answer, not even how many share a purchase.
create function public.my_bill(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select m.user_id
    from public.members m
    join public.events e on e.id = m.event_id
    where m.event_id = my_bill.target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'guest'
      and m.removed_at is null
      and e.expires_at > pg_catalog.now()
  ),
  sent as (
    select s.payee_name, s.swish_number
    from public.cost_settings s
    where s.event_id = my_bill.target_event_id
      and s.bill_sent_at is not null
  ),
  lines as (
    select
      p.position,
      p.name,
      pg_catalog.ceil(p.price_kr::numeric / n.sharers)::integer as share
    from me
    join public.cost_sharers mine on mine.user_id = me.user_id
    join public.cost_purchases p on p.id = mine.purchase_id
    cross join lateral (
      select pg_catalog.count(*) as sharers
      from public.cost_sharers s
      join public.members g
        on g.event_id = s.event_id and g.user_id = s.user_id
      where s.purchase_id = p.id
        and g.role = 'guest'
        and g.removed_at is null
    ) n
    where p.event_id = my_bill.target_event_id
  )
  select pg_catalog.jsonb_build_object(
    'payeeName', sent.payee_name,
    'swishNumber', sent.swish_number,
    'total', coalesce((select pg_catalog.sum(l.share) from lines l), 0)::integer,
    'lines', coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('name', l.name, 'share', l.share)
          order by l.position
        )
        from lines l
      ),
      '[]'::jsonb
    )
  )
  from sent
  where exists (select 1 from me);
$$;

revoke execute on function public.my_bill(uuid) from public, anon;
grant execute on function public.my_bill(uuid) to authenticated;
