-- Awards spec (#59), ticket #63: the host runs awards.
--
-- A category counts as revealed once it has been revealed. The reveal is a
-- flow write (set_event_flow); the trigger below marks the category in that
-- same statement, so a revealed category is never left unmarked. host-actions
-- reads which categories are revealed to know where awards start again.

-- ---------------------------------------------------------------------------
-- Marking the revealed category
-- ---------------------------------------------------------------------------

-- When the awards' phase turns `revealed`, sets the revealed time of the
-- category on the current step. A category that already has a time keeps it,
-- so a later reveal never changes it. Runs as the owner: no client can write
-- award_categories, and the flow is only written by host-actions.
create function private.mark_award_category_revealed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.award_categories c
  set revealed_at = pg_catalog.now()
  where c.event_id = new.id
    and c.position = new.current_step
    and c.status = 'approved'
    and c.revealed_at is null;
  return null;
end;
$$;

revoke execute on function private.mark_award_category_revealed() from public;

create trigger events_mark_award_category_revealed
  after update of phase on public.events
  for each row
  when (
    new.current_module = 'awards'
    and new.phase = 'revealed'
    and old.phase is distinct from 'revealed'
  )
  execute function private.mark_award_category_revealed();

-- ---------------------------------------------------------------------------
-- The awards' progress
-- ---------------------------------------------------------------------------

-- The number of approved categories and how many are revealed, so the TV can
-- say "Award 3 of 8" and the views know the winners step (step = total). One
-- row for a member of the event; no rows for anyone else.
create function public.award_progress(target_event_id uuid)
returns table (total integer, revealed integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*))::integer,
    (count(*) filter (where c.revealed_at is not null))::integer
  from public.award_categories c
  where c.event_id = target_event_id
    and c.status = 'approved'
  having public.is_member(target_event_id);
$$;

revoke execute on function public.award_progress(uuid) from public, anon;
grant execute on function public.award_progress(uuid) to authenticated;
