-- Visual design spec (#123), ticket #129: the bright-room switch.
--
-- The host switches the event to the light "day" theme for a bright room. It is
-- saved on the event, so the TV and the guests' phones follow it live through
-- the event row they already subscribe to. Clients keep select-only access to
-- events; the flag is written only by set_bright_room, which host-actions calls
-- after it has checked the admin key.

alter table public.events
  add column bright_room boolean not null default false;

-- Switches the bright-room theme on or off. Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
-- and 'updated' once written. Called by host-actions only.
create function public.set_bright_room(
  target_event_id uuid,
  bright boolean
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.events e
  set bright_room = set_bright_room.bright
  where e.id = set_bright_room.target_event_id
    and e.expires_at > pg_catalog.now();
  if not found then
    return 'not_found';
  end if;
  return 'updated';
end;
$$;

revoke execute on function public.set_bright_room(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_bright_room(uuid, boolean)
  to service_role;
