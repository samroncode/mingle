-- Backend core, spec 2 (#10), ticket #19: the database side of
-- `update_party_content`.
--
-- host-actions validates the content with the shared PartySchema and writes
-- it with update_event_party, after the admin key check passed.

-- Replaces the event's party-screen content and answers 'updated'. Changes
-- nothing and answers 'ended' when the event has ended, or 'not_found' when
-- it doesn't exist or has expired since the key check. The checks and the
-- write are one statement, so an event that ends or expires meanwhile is
-- never changed. Called by host-actions only after the admin key check.
create function public.update_event_party(target_event_id uuid, party jsonb)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_status text;
begin
  update public.events e
  set party = update_event_party.party
  where e.id = update_event_party.target_event_id
    and e.expires_at > pg_catalog.now()
    and e.status <> 'ended';
  if found then
    return 'updated';
  end if;

  select e.status into current_status
  from public.events e
  where e.id = update_event_party.target_event_id
    and e.expires_at > pg_catalog.now();
  return case when current_status = 'ended' then 'ended' else 'not_found' end;
end;
$$;

revoke execute on function public.update_event_party(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_event_party(uuid, jsonb)
  to service_role;
