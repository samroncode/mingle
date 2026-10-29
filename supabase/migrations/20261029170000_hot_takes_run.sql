-- Hot takes spec (#67), ticket #71: the host runs hot takes.
--
-- A hot take counts as revealed once it has been revealed. The reveal is a
-- flow write (set_event_flow); the trigger below marks the hot take in that
-- same statement, so a revealed hot take is never left unmarked. host-actions
-- reads which hot takes are revealed to know where hot takes start again.

-- ---------------------------------------------------------------------------
-- Marking the revealed hot take
-- ---------------------------------------------------------------------------

-- When the hot takes' phase turns `revealed`, sets the revealed time of the
-- hot take on the current step. A hot take that already has a time keeps it,
-- so a later reveal never changes it. Runs as the owner: no client can write
-- hot_takes, and the flow is only written by host-actions.
create function private.mark_hot_take_revealed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.hot_takes h
  set revealed_at = pg_catalog.now()
  where h.event_id = new.id
    and h.position = new.current_step
    and h.status = 'approved'
    and h.revealed_at is null;
  return null;
end;
$$;

revoke execute on function private.mark_hot_take_revealed() from public;

create trigger events_mark_hot_take_revealed
  after update of phase on public.events
  for each row
  when (
    new.current_module = 'hottakes'
    and new.phase = 'revealed'
    and old.phase is distinct from 'revealed'
  )
  execute function private.mark_hot_take_revealed();

-- ---------------------------------------------------------------------------
-- The hot takes' progress
-- ---------------------------------------------------------------------------

-- The number of approved hot takes and how many are revealed, so the TV can
-- say "Hot take 3 of 8" and the views know the summary step (step = total).
-- One row for a member of the event; no rows for anyone else.
create function public.hot_take_progress(target_event_id uuid)
returns table (total integer, revealed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*))::integer,
    (count(*) filter (where h.revealed_at is not null))::integer
  from public.hot_takes h
  where h.event_id = target_event_id
    and h.status = 'approved'
  having public.is_member(target_event_id);
$$;

revoke execute on function public.hot_take_progress(uuid) from public, anon;
grant execute on function public.hot_take_progress(uuid) to authenticated;
