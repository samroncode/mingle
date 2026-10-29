-- Shared costs spec (#175), ticket #179: a guest says "I've paid", and the
-- host confirms.
--
-- Swish gives private numbers no payment API, so Mingle never knows on its
-- own that someone paid. The guest says so (`set_i_paid`), the host confirms
-- what they see in Swish, or marks a guest paid directly for cash
-- (`set_payment`). Confirming stores the amount paid, so a purchase added
-- afterwards leaves the guest owing only the rest.

-- ---------------------------------------------------------------------------
-- The payments table
-- ---------------------------------------------------------------------------

-- One row per guest who has said they paid, or whom the host has confirmed.
-- No row means the guest owes everything. `says_paid_at` is set while the
-- guest says they paid and the host hasn't confirmed; `confirmed_kr` is the
-- total the host confirmed (null = not confirmed). Status is computed on
-- read, never stored.
create table public.cost_payments (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null,
  says_paid_at timestamptz,
  confirmed_kr integer check (confirmed_kr >= 0),
  confirmed_at timestamptz,
  primary key (event_id, user_id),
  foreign key (event_id, user_id)
    references public.members (event_id, user_id) on delete cascade,
  check ((confirmed_kr is null) = (confirmed_at is null))
);

-- Same rule as the other cost tables: only the host of the event reads, and
-- nobody writes directly.
revoke all on public.cost_payments from anon, authenticated;
grant select on public.cost_payments to authenticated;

alter table public.cost_payments enable row level security;

create policy "Hosts can read the payments of their event"
  on public.cost_payments for select
  to authenticated
  using (public.is_host(event_id));

-- ---------------------------------------------------------------------------
-- A guest's total
-- ---------------------------------------------------------------------------

-- The sum of a guest's shares: each purchase they share, its price divided by
-- the sharers who are not removed, rounded up to the next whole krona. 0 for
-- a guest who shares nothing.
create function private.guest_total(target_event_id uuid, target_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select coalesce(
    pg_catalog.sum(pg_catalog.ceil(p.price_kr::numeric / n.sharers)),
    0
  )::integer
  from public.cost_sharers mine
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
  where mine.event_id = target_event_id
    and mine.user_id = target_user_id
    and p.event_id = target_event_id;
$$;

revoke execute on function private.guest_total(uuid, uuid) from public;
grant execute on function private.guest_total(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- my_bill
-- ---------------------------------------------------------------------------

-- Same as before, plus the payment side, for the caller only:
--   { payeeName, swishNumber, total, confirmed, owed, status, lines }
-- `confirmed` is the amount the host has confirmed (0 if none), `owed` is
-- total minus confirmed, never below 0, and `status` is
--   'paid'       the host has confirmed and nothing is owed
--   'says_paid'  the guest says they paid, not yet confirmed
--   'owes'       anything else
-- A guest whose total grew after a confirmation is back to 'owes' (or
-- 'says_paid' if they say they paid the rest) for the difference.
create or replace function public.my_bill(target_event_id uuid)
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
  ),
  money as (
    select
      coalesce((select pg_catalog.sum(l.share) from lines l), 0)::integer as total,
      pay.confirmed_kr,
      pay.says_paid_at
    from me
    left join public.cost_payments pay
      on pay.event_id = my_bill.target_event_id and pay.user_id = me.user_id
  )
  select pg_catalog.jsonb_build_object(
    'payeeName', sent.payee_name,
    'swishNumber', sent.swish_number,
    'total', money.total,
    'confirmed', coalesce(money.confirmed_kr, 0),
    'owed', greatest(money.total - coalesce(money.confirmed_kr, 0), 0),
    'status', case
      when money.confirmed_kr is not null
        and money.total - money.confirmed_kr <= 0 then 'paid'
      when money.says_paid_at is not null then 'says_paid'
      else 'owes'
    end,
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
  from sent, money
  where exists (select 1 from me);
$$;

-- ---------------------------------------------------------------------------
-- set_i_paid
-- ---------------------------------------------------------------------------

-- The calling guest says they paid (`paid` true) or takes it back (false). It
-- changes the caller's own row only: the user comes from the session, never
-- from an argument.
--
-- Answers, changing nothing:
--   'not_found'          the caller isn't a current guest of a live event, or
--                        owes nothing (there is nothing to say paid for)
--   'not_sent'           the host hasn't sent the bill
--   'already_confirmed'  the host has confirmed everything the guest owes
-- and 'updated' once written. Works for an ended event too: people pay the
-- next day.
create function public.set_i_paid(target_event_id uuid, paid boolean)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  total integer;
  confirmed integer;
begin
  perform 1
  from public.events e
  join public.members m on m.event_id = e.id
  where e.id = set_i_paid.target_event_id
    and e.expires_at > pg_catalog.now()
    and m.user_id = caller
    and m.role = 'guest'
    and m.removed_at is null
  for share of e;
  if not found then
    return 'not_found';
  end if;

  perform 1
  from public.cost_settings s
  where s.event_id = set_i_paid.target_event_id
    and s.bill_sent_at is not null;
  if not found then
    return 'not_sent';
  end if;

  total := private.guest_total(set_i_paid.target_event_id, caller);

  -- Locks the row, so a confirmation and this change can't cross.
  select pay.confirmed_kr into confirmed
  from public.cost_payments pay
  where pay.event_id = set_i_paid.target_event_id
    and pay.user_id = caller
  for update;

  if confirmed is not null and total - confirmed <= 0 then
    return 'already_confirmed';
  end if;
  if total - coalesce(confirmed, 0) <= 0 then
    return 'not_found';
  end if;

  if set_i_paid.paid then
    insert into public.cost_payments as pay (event_id, user_id, says_paid_at)
    values (set_i_paid.target_event_id, caller, pg_catalog.now())
    on conflict (event_id, user_id) do update
    set says_paid_at = coalesce(pay.says_paid_at, excluded.says_paid_at);
  else
    update public.cost_payments pay
    set says_paid_at = null
    where pay.event_id = set_i_paid.target_event_id
      and pay.user_id = caller;
  end if;

  perform private.bump_costs_version(set_i_paid.target_event_id);
  return 'updated';
end;
$$;

revoke execute on function public.set_i_paid(uuid, boolean)
  from public, anon;
grant execute on function public.set_i_paid(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- set_payment
-- ---------------------------------------------------------------------------

-- The host settles a guest. `change` is
--   'confirm'  stores the guest's current total as the amount paid and
--              clears "says paid"; used both to confirm an "I've paid" and
--              to mark a guest paid directly (cash)
--   'undo'     clears the confirmation and "says paid" (a mistaken confirm)
--
-- Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check,
--                or the user isn't a current guest of it
--   'costs_off'  shared costs aren't switched on
--   'invalid'    `change` is neither of the above
-- and 'confirmed' or 'undone' once written. Works for an ended event too.
-- Called by host-actions only.
create function public.set_payment(
  target_event_id uuid,
  target_user_id uuid,
  change text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if set_payment.change not in ('confirm', 'undo') then
    return 'invalid';
  end if;

  perform 1
  from public.events e
  where e.id = set_payment.target_event_id
    and e.expires_at > pg_catalog.now()
  for share;
  if not found then
    return 'not_found';
  end if;

  perform 1
  from public.cost_settings s
  where s.event_id = set_payment.target_event_id;
  if not found then
    return 'costs_off';
  end if;

  perform 1
  from public.members m
  where m.event_id = set_payment.target_event_id
    and m.user_id = set_payment.target_user_id
    and m.role = 'guest'
    and m.removed_at is null;
  if not found then
    return 'not_found';
  end if;

  if set_payment.change = 'confirm' then
    insert into public.cost_payments as pay
      (event_id, user_id, confirmed_kr, confirmed_at)
    values (
      set_payment.target_event_id,
      set_payment.target_user_id,
      private.guest_total(
        set_payment.target_event_id, set_payment.target_user_id
      ),
      pg_catalog.now()
    )
    on conflict (event_id, user_id) do update
    set confirmed_kr = excluded.confirmed_kr,
        confirmed_at = excluded.confirmed_at,
        says_paid_at = null;
  else
    delete from public.cost_payments pay
    where pay.event_id = set_payment.target_event_id
      and pay.user_id = set_payment.target_user_id;
  end if;

  perform private.bump_costs_version(set_payment.target_event_id);
  return case when set_payment.change = 'confirm' then 'confirmed' else 'undone' end;
end;
$$;

revoke execute on function public.set_payment(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_payment(uuid, uuid, text) to service_role;
