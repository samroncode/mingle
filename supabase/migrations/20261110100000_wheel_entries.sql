-- Lucky wheel spec (#292), ticket #293: the host picks who is on the wheel.
-- The wheel is a fifth activity (`wheel`). This ticket stores its entries;
-- spinning comes in a later ticket.
--
-- Members read the entries of their event. Nobody writes the table from the
-- client: host-actions checks the admin key, then calls the functions below
-- with the service role.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- An entry is either a guest (its label is the guest's current display name,
-- so renames follow) or a custom entry with host-written text that is never
-- translated. Taking an entry off the wheel keeps the row, so it can be put
-- back. The limits match WheelLabelSchema in src/lib/schemas/wheel.ts.
create table public.wheel_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  kind text not null check (kind in ('guest', 'custom')),
  member_id uuid,
  label text,
  state text not null default 'on' check (state in ('on', 'off')),
  position integer not null check (position >= 0),
  created_at timestamptz not null default now(),
  -- A guest entry points at a member and has no text of its own; a custom
  -- entry has text and no member.
  constraint wheel_entries_shape_check check (
    (kind = 'guest' and member_id is not null and label is null)
    or (
      kind = 'custom'
      and member_id is null
      and label is not null
      and char_length(label) between 1 and 30
      and btrim(label) <> ''
    )
  ),
  -- A guest leaves the wheel when their member row goes. A removed guest
  -- keeps the row, so the trigger below handles that case.
  foreign key (event_id, member_id)
    references public.members (event_id, user_id) on delete cascade
);

-- A guest can be on the wheel only once per event. Custom entries have no
-- member, and null members never collide.
create unique index wheel_entries_guest_key
  on public.wheel_entries (event_id, member_id);

create index wheel_entries_event_id_idx
  on public.wheel_entries (event_id, position);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.wheel_entries from anon, authenticated;

grant select on public.wheel_entries to authenticated;
alter table public.wheel_entries enable row level security;

create policy "Members can read the wheel entries of their event"
  on public.wheel_entries for select
  to authenticated
  using (public.is_member(event_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Views follow entries being added, taken off, put back and removed.
alter publication supabase_realtime add table public.wheel_entries;

-- ---------------------------------------------------------------------------
-- A removed guest leaves the wheel
-- ---------------------------------------------------------------------------

create function private.remove_wheel_entry_of_removed_guest()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.wheel_entries w
  where w.event_id = new.event_id
    and w.member_id = new.user_id;
  return new;
end;
$$;

revoke execute on function private.remove_wheel_entry_of_removed_guest()
  from public, anon, authenticated;

create trigger members_remove_wheel_entry
  after update of removed_at on public.members
  for each row
  when (old.removed_at is null and new.removed_at is not null)
  execute function private.remove_wheel_entry_of_removed_guest();

-- ---------------------------------------------------------------------------
-- Host functions
-- ---------------------------------------------------------------------------

-- Locks the event row and answers why the wheel can't be changed, or null
-- when it can:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'disabled'   the event has the Lucky wheel switched off
-- The lock makes the count checks in the callers safe against a parallel
-- call for the same event.
create function private.lock_event_for_wheel(target_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.events%rowtype;
begin
  select e.* into target
  from public.events e
  where e.id = lock_event_for_wheel.target_event_id
    and e.expires_at > pg_catalog.now()
  for update;
  if not found then
    return 'not_found';
  end if;
  if target.status = 'ended' then
    return 'ended';
  end if;
  if not ('wheel' = any (target.enabled_modules)) then
    return 'disabled';
  end if;
  return null;
end;
$$;

revoke execute on function private.lock_event_for_wheel(uuid)
  from public, anon, authenticated;
grant execute on function private.lock_event_for_wheel(uuid)
  to service_role;

-- Puts guests on the wheel, last in the list and on it, in the order given.
-- All or nothing. Answers, changing nothing: 'not_found', 'ended',
-- 'disabled' (see above), 'unknown_guest' (an id that isn't a current guest
-- of this event), 'already_added' (a guest who is on the wheel or listed
-- twice) and 'too_many' (the wheel would pass 24 entries). 'added' once
-- written. Called by host-actions only.
create function public.add_wheel_guests(
  target_event_id uuid,
  guest_ids uuid[]
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  wanted integer;
  found_guests integer;
  existing integer;
  next_position integer;
begin
  refusal := private.lock_event_for_wheel(add_wheel_guests.target_event_id);
  if refusal is not null then
    return refusal;
  end if;

  wanted := coalesce(pg_catalog.cardinality(add_wheel_guests.guest_ids), 0);
  if wanted = 0 then
    return 'unknown_guest';
  end if;

  select count(distinct m.user_id)::integer into found_guests
  from public.members m
  where m.event_id = add_wheel_guests.target_event_id
    and m.role = 'guest'
    and m.removed_at is null
    and m.user_id = any (add_wheel_guests.guest_ids);
  if found_guests <> (
    select count(distinct g.id)::integer
    from pg_catalog.unnest(add_wheel_guests.guest_ids) as g(id)
  ) then
    return 'unknown_guest';
  end if;

  if wanted <> found_guests or exists (
    select 1
    from public.wheel_entries w
    where w.event_id = add_wheel_guests.target_event_id
      and w.member_id = any (add_wheel_guests.guest_ids)
  ) then
    return 'already_added';
  end if;

  select count(*)::integer, coalesce(max(w.position) + 1, 0)
  into existing, next_position
  from public.wheel_entries w
  where w.event_id = add_wheel_guests.target_event_id;
  if existing + wanted > 24 then
    return 'too_many';
  end if;

  insert into public.wheel_entries (event_id, kind, member_id, position)
  select
    add_wheel_guests.target_event_id,
    'guest',
    g.id,
    next_position + (g.ordinality - 1)::integer
  from pg_catalog.unnest(add_wheel_guests.guest_ids)
    with ordinality as g(id, ordinality);

  return 'added';
end;
$$;

revoke execute on function public.add_wheel_guests(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.add_wheel_guests(uuid, uuid[])
  to service_role;

-- Adds an entry with the host's own text last in the list. host-actions has
-- already trimmed the text with the shared schema; it is cleaned here too and
-- must be 1 to 30 characters afterwards. Answers, changing nothing:
-- 'not_found', 'ended', 'disabled', 'invalid_name' and 'too_many' (the wheel
-- already has 24 entries). 'added' once written.
create function public.add_wheel_custom(
  target_event_id uuid,
  entry_label text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  cleaned text;
  existing integer;
  next_position integer;
begin
  refusal := private.lock_event_for_wheel(add_wheel_custom.target_event_id);
  if refusal is not null then
    return refusal;
  end if;

  cleaned := private.clean_display_name(add_wheel_custom.entry_label);
  if cleaned is null or char_length(cleaned) not between 1 and 30 then
    return 'invalid_name';
  end if;

  select count(*)::integer, coalesce(max(w.position) + 1, 0)
  into existing, next_position
  from public.wheel_entries w
  where w.event_id = add_wheel_custom.target_event_id;
  if existing >= 24 then
    return 'too_many';
  end if;

  insert into public.wheel_entries (event_id, kind, label, position)
  values (add_wheel_custom.target_event_id, 'custom', cleaned, next_position);

  return 'added';
end;
$$;

revoke execute on function public.add_wheel_custom(uuid, text)
  from public, anon, authenticated;
grant execute on function public.add_wheel_custom(uuid, text)
  to service_role;

-- Takes an entry off the wheel ('off') or puts it back ('on'). The row stays.
-- Answers, changing nothing: 'not_found', 'ended', 'disabled' and 'unknown'
-- (no such entry in this event). 'updated' once written.
create function public.set_wheel_entry_state(
  target_event_id uuid,
  entry_id uuid,
  new_state text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
begin
  refusal := private.lock_event_for_wheel(
    set_wheel_entry_state.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  if set_wheel_entry_state.new_state not in ('on', 'off') then
    return 'unknown';
  end if;

  update public.wheel_entries w
  set state = set_wheel_entry_state.new_state
  where w.id = set_wheel_entry_state.entry_id
    and w.event_id = set_wheel_entry_state.target_event_id;
  if not found then
    return 'unknown';
  end if;

  return 'updated';
end;
$$;

revoke execute on function public.set_wheel_entry_state(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_wheel_entry_state(uuid, uuid, text)
  to service_role;

-- Deletes an entry from the wheel for good. Answers, changing nothing:
-- 'not_found', 'ended', 'disabled' and 'unknown'. 'deleted' once written.
create function public.delete_wheel_entry(
  target_event_id uuid,
  entry_id uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
begin
  refusal := private.lock_event_for_wheel(delete_wheel_entry.target_event_id);
  if refusal is not null then
    return refusal;
  end if;

  delete from public.wheel_entries w
  where w.id = delete_wheel_entry.entry_id
    and w.event_id = delete_wheel_entry.target_event_id;
  if not found then
    return 'unknown';
  end if;

  return 'deleted';
end;
$$;

revoke execute on function public.delete_wheel_entry(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_wheel_entry(uuid, uuid)
  to service_role;
