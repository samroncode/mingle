-- Host control panel spec (#75), ticket #79: the host renames a guest.
--
-- host-actions checks the admin key, then writes with rename_guest. A
-- guest's answers, votes and score belong to their user, not their name, so
-- only the display_name column changes.

-- Gives the guest `target_user_id` of the event the name `new_name`. The
-- name is cleaned by the members_trim_display_name trigger and checked by
-- the table's length check and the unique name index, the same rules as
-- join_event and a guest renaming themselves.
--
-- Answers, changing nothing:
--   'no_event'      the event doesn't exist or has expired since the key
--                   check
--   'not_found'     the user isn't a guest of this event (a host, a TV, a
--                   member of another event, an unknown user)
--   'ended'         the event has ended
--   'name_taken'    another guest of the event has the name
--   'invalid_name'  the cleaned name isn't 1 to 30 characters
-- and 'renamed' once written.
--
-- The guest check and the write are one update, so a guest can't turn into
-- anything else in between. Called by host-actions only.
create function public.rename_guest(
  target_event_id uuid,
  target_user_id uuid,
  new_name text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_status text;
  violated_constraint text;
begin
  select e.status into event_status
  from public.events e
  where e.id = rename_guest.target_event_id
    and e.expires_at > pg_catalog.now()
  for share;
  if not found then
    return 'no_event';
  end if;
  if event_status = 'ended' then
    return 'ended';
  end if;

  begin
    update public.members m
    set display_name = rename_guest.new_name
    where m.event_id = rename_guest.target_event_id
      and m.user_id = rename_guest.target_user_id
      and m.role = 'guest';
  exception
    when unique_violation then
      get stacked diagnostics violated_constraint = constraint_name;
      if violated_constraint = 'members_guest_name_key' then
        return 'name_taken';
      end if;
      raise;
    when check_violation then
      return 'invalid_name';
  end;
  if not found then
    return 'not_found';
  end if;

  return 'renamed';
end;
$$;

revoke execute on function public.rename_guest(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.rename_guest(uuid, uuid, text)
  to service_role;
