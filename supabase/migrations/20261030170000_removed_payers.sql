-- Shared costs spec (#175), ticket #181: a removed guest who had paid.
--
-- Removing a guest already drops them from every purchase: shares are
-- computed on read from the sharers who are not removed, so the others'
-- totals go up on their own. What the host still needs is a note when the
-- removed guest had said they paid, or the host had confirmed it, since that
-- money has to be paid back by hand. Removed members are hidden from the
-- members policy, so the host reads them through this function.

-- The removed guests who had said they paid or been confirmed, for the host
-- of the event only:
--   [{ userId, name, paidKr }]
-- `paidKr` is the amount the host confirmed, or null when the guest only said
-- they paid. A guest who paid nothing leaves no entry. Anyone else gets [].
create function public.removed_payers(target_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'userId', m.user_id,
        'name', m.display_name,
        'paidKr', c.confirmed_kr
      )
      order by m.display_name
    ),
    '[]'::jsonb
  )
  from public.cost_payments c
  join public.members m
    on m.event_id = c.event_id and m.user_id = c.user_id
  where public.is_host(removed_payers.target_event_id)
    and c.event_id = removed_payers.target_event_id
    and m.removed_at is not null
    and (c.says_paid_at is not null or c.confirmed_kr is not null);
$$;

revoke execute on function public.removed_payers(uuid)
  from public, anon;
grant execute on function public.removed_payers(uuid) to authenticated;
