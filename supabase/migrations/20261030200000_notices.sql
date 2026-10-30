-- Winners and host messages spec (#206), ticket #210: notices the host sends
-- to the guests' phones.
--
-- Members read the notices of their event; nobody writes the table. The host
-- sends and deletes through the two functions below, which host-actions calls
-- after it has checked the admin key. Both raise `events.notices_version` in
-- the same transaction, the signal the phones follow through the event row
-- (same idea as `costs_version`). Notices are plain text typed by the host.

alter table public.events
  add column notices_version integer not null default 0;

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  -- Trimmed, 1 to 140 characters.
  text text not null
    check (
      pg_catalog.char_length(text) between 1 and 140
      and text !~ '^\s|\s$'
    ),
  created_at timestamptz not null default pg_catalog.now()
);

create index notices_event_created_idx
  on public.notices (event_id, created_at desc);

-- Take back the default privileges, then grant only reading.
revoke all on public.notices from anon, authenticated;

grant select on public.notices to authenticated;
alter table public.notices enable row level security;

-- Guests, the TV and the host read them; a removed guest, a non-member and
-- anyone on an expired event don't (is_member checks all three).
create policy "Members can read the notices of their event"
  on public.notices for select
  to authenticated
  using (public.is_member(event_id));

-- Sends a notice. `notice_text` is trimmed here. Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'invalid'    the text isn't 1 to 140 characters once trimmed
--   'too_many'   the event already has 30 notices
--   'too_soon'   the last notice was sent less than 5 seconds ago
-- and 'sent' once written. Called by host-actions only.
create function public.send_notice(
  target_event_id uuid,
  notice_text text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  event_status text;
  cleaned text;
  notice_count integer;
  last_sent timestamptz;
begin
  -- The row lock makes two sends at once take turns, so the limits hold.
  select e.status
  into event_status
  from public.events e
  where e.id = send_notice.target_event_id
    and e.expires_at > pg_catalog.now()
  for no key update;
  if not found then
    return 'not_found';
  end if;
  if event_status = 'ended' then
    return 'ended';
  end if;

  cleaned := pg_catalog.regexp_replace(
    coalesce(send_notice.notice_text, ''), '^\s+|\s+$', '', 'g'
  );
  if pg_catalog.char_length(cleaned) not between 1 and 140 then
    return 'invalid';
  end if;

  select pg_catalog.count(*), pg_catalog.max(n.created_at)
  into notice_count, last_sent
  from public.notices n
  where n.event_id = send_notice.target_event_id;
  if notice_count >= 30 then
    return 'too_many';
  end if;
  if last_sent is not null
    and pg_catalog.clock_timestamp() - last_sent < interval '5 seconds' then
    return 'too_soon';
  end if;

  insert into public.notices (event_id, text, created_at)
  values (
    send_notice.target_event_id,
    cleaned,
    pg_catalog.clock_timestamp()
  );

  update public.events e
  set notices_version = e.notices_version + 1
  where e.id = send_notice.target_event_id;

  return 'sent';
end;
$$;

revoke execute on function public.send_notice(uuid, text)
  from public, anon, authenticated;
grant execute on function public.send_notice(uuid, text) to service_role;

-- Deletes a notice of the event, so it disappears from the phones. Answers
-- 'not_found' for an unknown notice, one of another event, and an event that
-- doesn't exist or has expired; 'deleted' once removed. Called by
-- host-actions only.
create function public.delete_notice(
  target_event_id uuid,
  notice_id uuid
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
  where e.id = delete_notice.target_event_id
    and e.expires_at > pg_catalog.now()
  for no key update;
  if not found then
    return 'not_found';
  end if;

  delete from public.notices n
  where n.id = delete_notice.notice_id
    and n.event_id = delete_notice.target_event_id;
  if not found then
    return 'not_found';
  end if;

  update public.events e
  set notices_version = e.notices_version + 1
  where e.id = delete_notice.target_event_id;

  return 'deleted';
end;
$$;

revoke execute on function public.delete_notice(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_notice(uuid, uuid) to service_role;
