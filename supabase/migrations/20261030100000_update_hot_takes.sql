-- Hot takes spec (#67), ticket #74: the host edits the unrevealed hot
-- takes during the evening.
--
-- host-actions validates the takes with the shared hot takes schema and
-- writes them with update_hot_takes, after the admin key check passed.

-- Replaces the event's unrevealed hot takes with `takes`, a JSON
-- array of `{ text }` in the order chosen, placed after the revealed ones.
-- Revealed hot takes keep their text, reveal time and answers. They move up to
-- the first positions in their order, so the steps stay 0, 1, 2, ...; while
-- hot takes run, their step moves to the first unrevealed hot take, where
-- start_module would resume. Answers to a removed hot take go with it.
--
-- Answers, changing nothing:
--   'not_found'  the event doesn't exist or has expired since the key check
--   'ended'      the event has ended
--   'busy'       hot takes are on a hot take that is open or revealed
--   'finished'   every hot take has been revealed, so hot takes stay finished
--   'disabled'   hot takes for an event with hot takes switched off
--   'too_many'   revealed and new hot takes together are more than 20
-- and 'updated' once written.
--
-- The event row is locked first, so a flow move (open, reveal) that lands
-- meanwhile waits for this transaction and then finds the flow it read gone;
-- and this function, waiting for a move, sees the move's result. A hot take
-- is never changed after it was shown. Called by host-actions only.
create function public.update_hot_takes(
  target_event_id uuid,
  takes jsonb
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  target public.events%rowtype;
  revealed_count integer;
  unrevealed_count integer;
  new_position integer := 0;
  revealed_id uuid;
begin
  select e.* into target
  from public.events e
  where e.id = update_hot_takes.target_event_id
    and e.expires_at > pg_catalog.now()
  for update;
  if not found then
    return 'not_found';
  end if;
  if target.status = 'ended' then
    return 'ended';
  end if;
  if target.current_module = 'hottakes' and target.phase <> 'idle' then
    return 'busy';
  end if;

  select
    (count(*) filter (where c.revealed_at is not null))::integer,
    (count(*) filter (where c.revealed_at is null))::integer
  into revealed_count, unrevealed_count
  from public.hot_takes c
  where c.event_id = target.id;

  if revealed_count > 0 and unrevealed_count = 0 then
    return 'finished';
  end if;
  if pg_catalog.jsonb_array_length(update_hot_takes.takes) > 0
    and not ('hottakes' = any (target.enabled_modules)) then
    return 'disabled';
  end if;
  if revealed_count
    + pg_catalog.jsonb_array_length(update_hot_takes.takes) > 20 then
    return 'too_many';
  end if;

  delete from public.hot_takes c
  where c.event_id = target.id
    and c.revealed_at is null;

  -- One row at a time, lowest first: a revealed hot take only ever moves down
  -- to a free position, so (event_id, position) stays unique on every row.
  for revealed_id in
    select c.id
    from public.hot_takes c
    where c.event_id = target.id
    order by c.position
  loop
    update public.hot_takes c
    set position = new_position
    where c.id = revealed_id
      and c.position <> new_position;
    new_position := new_position + 1;
  end loop;

  insert into public.hot_takes (event_id, position, text)
  select
    target.id,
    revealed_count + (c.ordinality - 1)::integer,
    c.value ->> 'text'
  from pg_catalog.jsonb_array_elements(update_hot_takes.takes)
    with ordinality as c(value, ordinality);

  if target.current_module = 'hottakes' then
    update public.events e
    set current_step = revealed_count
    where e.id = target.id
      and e.current_step <> revealed_count;
  end if;

  return 'updated';
end;
$$;

revoke execute on function public.update_hot_takes(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.update_hot_takes(uuid, jsonb)
  to service_role;
