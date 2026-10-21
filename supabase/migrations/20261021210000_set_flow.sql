-- Backend core, spec 2 (#10), ticket #20: the database side of `set_flow`.
--
-- host-actions decides which move is allowed (supabase/functions/host-actions/
-- flow.ts) and writes the new flow with set_event_flow. The constraint below
-- holds the same shape here, so no write can leave the event broken.

-- ---------------------------------------------------------------------------
-- The shape of a valid flow
-- ---------------------------------------------------------------------------

-- Either no activity is running (lobby, the party screen while live, or
-- ended), and the step and phase are reset; or the event is live and runs one
-- of its enabled activities.
alter table public.events
  add constraint events_flow_check check (
    (current_module is null and current_step = 0 and phase = 'idle')
    or (
      status = 'live'
      and current_module is not null
      and current_module = any (enabled_modules)
    )
  );

-- ---------------------------------------------------------------------------
-- Writing the flow
-- ---------------------------------------------------------------------------

-- Moves the event from the flow `from_*` to the flow `to_*`, but only if the
-- event still has exactly the `from_*` flow and hasn't expired. host-actions
-- read `from_*` and checked the move against it; if another move landed in
-- between, nothing changes and this returns false, so two moves can never
-- both apply to the same state. Called only after the admin key check passed.
-- The modules come last and default to null (no activity running), so the
-- generated types let host-actions leave them out.
create function public.set_event_flow(
  target_event_id uuid,
  from_status text,
  from_step integer,
  from_phase text,
  to_status text,
  to_step integer,
  to_phase text,
  from_module text default null,
  to_module text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.events e
  set status = set_event_flow.to_status,
      current_module = set_event_flow.to_module,
      current_step = set_event_flow.to_step,
      phase = set_event_flow.to_phase
  where e.id = set_event_flow.target_event_id
    and e.expires_at > pg_catalog.now()
    and e.status = set_event_flow.from_status
    and e.current_module is not distinct from set_event_flow.from_module
    and e.current_step = set_event_flow.from_step
    and e.phase = set_event_flow.from_phase;

  return found;
end;
$$;

revoke execute on function public.set_event_flow(
  uuid, text, integer, text, text, integer, text, text, text
) from public, anon, authenticated;
grant execute on function public.set_event_flow(
  uuid, text, integer, text, text, integer, text, text, text
) to service_role;
