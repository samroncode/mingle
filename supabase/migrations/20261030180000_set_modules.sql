-- Host control panel spec (#75), ticket #81: the host switches activities on
-- and off.
--
-- host-actions checks the admin key, then writes the list with
-- set_enabled_modules. The enabled activities are stored in the order the
-- panel shows them. The events_flow_check constraint already holds that the
-- running activity is among them; this function answers it with a code first.

-- Replaces the event's enabled activities with `modules`, in order. host-actions
-- has already checked that every id is a known activity and none repeats.
--
-- Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'running'    the list leaves out the activity that is running
-- and 'updated' once written. Called by host-actions only.
create function public.set_enabled_modules(
  target_event_id uuid,
  modules text[]
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_status text;
  running_module text;
begin
  select e.status, e.current_module
  into event_status, running_module
  from public.events e
  where e.id = set_enabled_modules.target_event_id
    and e.expires_at > pg_catalog.now()
  for no key update;
  if not found then
    return 'not_found';
  end if;
  if event_status = 'ended' then
    return 'ended';
  end if;
  if running_module is not null
    and not (running_module = any (set_enabled_modules.modules)) then
    return 'running';
  end if;

  update public.events e
  set enabled_modules = set_enabled_modules.modules
  where e.id = set_enabled_modules.target_event_id;

  return 'updated';
end;
$$;

revoke execute on function public.set_enabled_modules(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.set_enabled_modules(uuid, text[])
  to service_role;
