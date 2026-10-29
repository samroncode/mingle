-- Hot takes spec (#67), ticket #73: splits and highlights.
--
-- The result of a revealed hot take, read through `security definer`
-- functions because no client reads an answer row but its guest. A hot take is
-- revealed once it has a revealed time. Only answers from a guest who still
-- has a display name count (a guest who became host, or who has no name, is
-- out). Answers belong to members, not names, so a rename keeps every answer.

-- ---------------------------------------------------------------------------
-- Helper (server-only)
-- ---------------------------------------------------------------------------

-- The agree and disagree counts of each revealed, approved hot take of the
-- event; 0 and 0 when nobody answered. Not callable by clients: the public
-- functions below check who may see what.
create function private.hot_take_counts(target_event_id uuid)
returns table (
  hot_take_id uuid,
  hot_take_position integer,
  hot_take_text text,
  agree_count integer,
  disagree_count integer
)
language sql
stable
set search_path = ''
as $$
  select
    h.id,
    h.position,
    h.text,
    (
      select count(*)
      from public.hot_take_answers a
      join public.members g
        on g.event_id = a.event_id and g.user_id = a.guest_id
      where a.hot_take_id = h.id
        and a.agree
        and g.role = 'guest'
        and g.display_name is not null
    )::integer,
    (
      select count(*)
      from public.hot_take_answers a
      join public.members g
        on g.event_id = a.event_id and g.user_id = a.guest_id
      where a.hot_take_id = h.id
        and not a.agree
        and g.role = 'guest'
        and g.display_name is not null
    )::integer
  from public.hot_takes h
  where h.event_id = target_event_id
    and h.status = 'approved'
    and h.revealed_at is not null;
$$;

revoke execute on function private.hot_take_counts(uuid) from public;

-- ---------------------------------------------------------------------------
-- One hot take
-- ---------------------------------------------------------------------------

-- The agree and disagree counts of a revealed hot take, for every member of
-- the event. Nothing for an unrevealed or unknown hot take, a draft or a
-- non-member. One row with 0 and 0 when nobody answered.
create function public.hot_take_result(target_hot_take_id uuid)
returns table (agree_count integer, disagree_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.agree_count, n.disagree_count
  from public.hot_takes h
  join private.hot_take_counts(h.event_id) n on n.hot_take_id = h.id
  where h.id = target_hot_take_id
    and public.is_member(h.event_id);
$$;

revoke execute on function public.hot_take_result(uuid) from public, anon;
grant execute on function public.hot_take_result(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The end
-- ---------------------------------------------------------------------------

-- The summary's two highlights, for a member: the most divisive revealed hot
-- take (closest to 50/50) and the most agreed (largest share on one side),
-- each with its split. Ties go to the lower position. Hot takes without
-- answers are left out, so no rows when none had answers.
create function public.hot_take_highlights(target_event_id uuid)
returns table (
  highlight text,
  hot_take_id uuid,
  hot_take_position integer,
  hot_take_text text,
  agree_count integer,
  disagree_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with answered as (
    select
      n.*,
      (n.agree_count + n.disagree_count)::numeric as total
    from private.hot_take_counts(target_event_id) n
    where n.agree_count + n.disagree_count > 0
      and public.is_member(target_event_id)
  ),
  divisive as (
    select 'divisive'::text as highlight, a.*
    from answered a
    order by
      pg_catalog.abs(a.agree_count - a.disagree_count)::numeric / a.total,
      a.hot_take_position
    limit 1
  ),
  agreed as (
    select 'agreed'::text as highlight, a.*
    from answered a
    order by
      greatest(a.agree_count, a.disagree_count)::numeric / a.total
        desc,
      a.hot_take_position
    limit 1
  )
  select d.highlight, d.hot_take_id, d.hot_take_position, d.hot_take_text,
    d.agree_count, d.disagree_count
  from divisive d
  union all
  select g.highlight, g.hot_take_id, g.hot_take_position, g.hot_take_text,
    g.agree_count, g.disagree_count
  from agreed g
  order by 1;
$$;

revoke execute on function public.hot_take_highlights(uuid) from public, anon;
grant execute on function public.hot_take_highlights(uuid) to authenticated;

-- How many times the caller sided with the majority, out of the revealed hot
-- takes they answered that had a majority (an even split has none). One row
-- for a guest with a name in the event; none for anyone else.
create function public.my_hot_take_majority(target_event_id uuid)
returns table (sided integer, answered integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (count(*) filter (
      where a.agree = (n.agree_count > n.disagree_count)
    ))::integer,
    (count(*))::integer
  from private.hot_take_counts(target_event_id) n
  join public.hot_take_answers a on a.hot_take_id = n.hot_take_id
  where a.guest_id = (select auth.uid())
    and n.agree_count <> n.disagree_count
  having exists (
    select 1
    from public.members m
    where m.event_id = target_event_id
      and m.user_id = (select auth.uid())
      and m.role = 'guest'
      and m.display_name is not null
  );
$$;

revoke execute on function public.my_hot_take_majority(uuid) from public, anon;
grant execute on function public.my_hot_take_majority(uuid) to authenticated;
