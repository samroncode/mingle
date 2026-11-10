-- Lucky wheel spec (#292), ticket #295: spinning the wheel.
--
-- The host presses Spin; the server picks the winner and stores the spin, so
-- every screen renders the same result (CLAUDE.md principle 1). A per-event
-- setting can take the winner off the wheel in the same step.
--
-- Members read the spins of their event. Nobody writes from the client:
-- host-actions checks the admin key, then calls the functions below with the
-- service role.

-- ---------------------------------------------------------------------------
-- The setting
-- ---------------------------------------------------------------------------

-- "Take drawn entries off automatically". Off by default. The TV and phones
-- already read the event row; clients keep select-only access to events.
alter table public.events
  add column wheel_auto_take_off boolean not null default false;

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- One row per spin. `label` is a snapshot of what the entry was called when it
-- was drawn (a guest's display name, or the host's text), so history still
-- reads right after a rename or a delete. `entry_id` is null once the entry
-- is deleted.
create table public.wheel_spins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  number integer not null check (number >= 1),
  entry_id uuid references public.wheel_entries (id) on delete set null,
  label text not null check (char_length(label) between 1 and 30),
  spun_at timestamptz not null default now(),
  -- The running number counts up within the event.
  constraint wheel_spins_number_key unique (event_id, number)
);

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

revoke all on public.wheel_spins from anon, authenticated;

grant select on public.wheel_spins to authenticated;
alter table public.wheel_spins enable row level security;

create policy "Members can read the wheel spins of their event"
  on public.wheel_spins for select
  to authenticated
  using (public.is_member(event_id));

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Every screen follows new spins and a cleared list.
alter publication supabase_realtime add table public.wheel_spins;

-- ---------------------------------------------------------------------------
-- Host functions
-- ---------------------------------------------------------------------------

-- Draws a winner among the entries that are on the wheel and stores the spin.
-- The pick is made here, uniformly at random, and nowhere else. When the
-- event's setting is on, the winner is taken off the wheel in the same
-- transaction. Answers, changing nothing:
--   'not_found'          the event doesn't exist or has expired
--   'ended'              the event has ended
--   'disabled'           the wheel is switched off
--   'not_running'        the wheel isn't the running activity
--   'not_enough_entries' fewer than two entries are on the wheel
-- and 'spun' once written. Called by host-actions only.
create function public.spin_wheel(target_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  target public.events%rowtype;
  winner_id uuid;
  winner_label text;
  on_wheel integer;
  next_number integer;
begin
  -- Locks the event row, so two spins at once get different numbers and see
  -- each other's take-off.
  refusal := private.lock_event_for_wheel(spin_wheel.target_event_id);
  if refusal is not null then
    return refusal;
  end if;

  select e.* into target
  from public.events e
  where e.id = spin_wheel.target_event_id;
  if target.status <> 'live' or target.current_module is distinct from 'wheel'
  then
    return 'not_running';
  end if;

  select count(*)::integer into on_wheel
  from public.wheel_entries w
  where w.event_id = spin_wheel.target_event_id
    and w.state = 'on';
  if on_wheel < 2 then
    return 'not_enough_entries';
  end if;

  -- Uniform: every entry on the wheel has the same chance, whatever its
  -- position, and a taken-off entry is never in the set.
  select w.id, coalesce(w.label, m.display_name)
  into winner_id, winner_label
  from public.wheel_entries w
  left join public.members m
    on m.event_id = w.event_id and m.user_id = w.member_id
  where w.event_id = spin_wheel.target_event_id
    and w.state = 'on'
  order by pg_catalog.random()
  limit 1;

  select coalesce(max(s.number), 0) + 1 into next_number
  from public.wheel_spins s
  where s.event_id = spin_wheel.target_event_id;

  insert into public.wheel_spins (event_id, number, entry_id, label)
  values (
    spin_wheel.target_event_id,
    next_number,
    winner_id,
    winner_label
  );

  if target.wheel_auto_take_off then
    update public.wheel_entries w
    set state = 'off'
    where w.id = winner_id;
  end if;

  return 'spun';
end;
$$;

revoke execute on function public.spin_wheel(uuid)
  from public, anon, authenticated;
grant execute on function public.spin_wheel(uuid)
  to service_role;

-- Switches "take drawn entries off automatically" on or off. Answers,
-- changing nothing: 'not_found', 'ended' and 'disabled' (see above).
-- 'updated' once written. It may be changed while the wheel runs.
create function public.set_wheel_auto_take_off(
  target_event_id uuid,
  enabled boolean
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
    set_wheel_auto_take_off.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  update public.events e
  set wheel_auto_take_off = set_wheel_auto_take_off.enabled
  where e.id = set_wheel_auto_take_off.target_event_id;

  return 'updated';
end;
$$;

revoke execute on function public.set_wheel_auto_take_off(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.set_wheel_auto_take_off(uuid, boolean)
  to service_role;

-- Deletes the event's list of spins; the running number starts over at 1.
-- Answers, changing nothing: 'not_found', 'ended' and 'disabled' (see
-- above). 'cleared' once done.
create function public.clear_wheel_spins(target_event_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
begin
  refusal := private.lock_event_for_wheel(clear_wheel_spins.target_event_id);
  if refusal is not null then
    return refusal;
  end if;

  delete from public.wheel_spins s
  where s.event_id = clear_wheel_spins.target_event_id;

  return 'cleared';
end;
$$;

revoke execute on function public.clear_wheel_spins(uuid)
  from public, anon, authenticated;
grant execute on function public.clear_wheel_spins(uuid)
  to service_role;
