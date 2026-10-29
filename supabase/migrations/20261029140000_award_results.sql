-- Awards spec (#59), ticket #65: the winners.
--
-- The results of a revealed category, read through `security definer`
-- functions because no client reads a vote row but its voter. A category is
-- revealed once it has a revealed time. Only votes for a guest who still has a
-- display name count (a guest who became host, or who has no name, is out).
-- Votes belong to members, not names, so a rename keeps every vote.

-- ---------------------------------------------------------------------------
-- Helpers (server-only)
-- ---------------------------------------------------------------------------

-- The votes each guest got on each revealed, approved category of the event.
-- Guests with a name and no votes get 0. Not callable by clients: the public
-- functions below check who may see what.
create function private.award_counts(target_event_id uuid)
returns table (category_id uuid, user_id uuid, votes integer)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    g.user_id,
    (
      select count(*)
      from public.award_votes v
      where v.category_id = c.id and v.voted_for_id = g.user_id
    )::integer
  from public.award_categories c
  join public.members g on g.event_id = c.event_id
  where c.event_id = target_event_id
    and c.status = 'approved'
    and c.revealed_at is not null
    and g.role = 'guest'
    and g.display_name is not null;
$$;

revoke execute on function private.award_counts(uuid) from public;

-- The winner or winners of each revealed category: the guests with the most
-- votes, all of them on a tie. A category nobody voted on has none.
create function private.award_winners(target_event_id uuid)
returns table (category_id uuid, user_id uuid, votes integer)
language sql
stable
set search_path = ''
as $$
  select r.category_id, r.user_id, r.votes
  from (
    select
      n.category_id,
      n.user_id,
      n.votes,
      pg_catalog.max(n.votes) over (partition by n.category_id) as best
    from private.award_counts(target_event_id) n
  ) r
  where r.votes = r.best and r.votes > 0;
$$;

revoke execute on function private.award_winners(uuid) from public;

-- ---------------------------------------------------------------------------
-- One category
-- ---------------------------------------------------------------------------

-- The winner or winners of a revealed category and their vote count, for every
-- member of the event. Nothing for an unrevealed or unknown category, a draft
-- or a non-member. A category nobody voted on has no rows.
create function public.award_winners(target_category_id uuid)
returns table (user_id uuid, votes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select w.user_id, w.votes
  from public.award_categories c
  join private.award_winners(c.event_id) w on w.category_id = c.id
  where c.id = target_category_id
    and public.is_member(c.event_id)
  order by w.user_id;
$$;

revoke execute on function public.award_winners(uuid) from public, anon;
grant execute on function public.award_winners(uuid) to authenticated;

-- The full count per guest on a revealed category, best first, every guest
-- with a name included. Only the host of the event gets rows.
create function public.award_tally(target_category_id uuid)
returns table (user_id uuid, votes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.user_id, n.votes
  from public.award_categories c
  join private.award_counts(c.event_id) n on n.category_id = c.id
  where c.id = target_category_id
    and public.is_host(c.event_id)
  order by n.votes desc, n.user_id;
$$;

revoke execute on function public.award_tally(uuid) from public, anon;
grant execute on function public.award_tally(uuid) to authenticated;

-- How many votes the caller got on a revealed category. One row for a guest
-- with a name in the event; none for anyone else.
create function public.my_award_votes(target_category_id uuid)
returns table (votes integer)
language sql
stable
security definer
set search_path = ''
as $$
  select n.votes
  from public.award_categories c
  join private.award_counts(c.event_id) n on n.category_id = c.id
  where c.id = target_category_id
    and n.user_id = (select auth.uid())
    and public.is_member(c.event_id);
$$;

revoke execute on function public.my_award_votes(uuid) from public, anon;
grant execute on function public.my_award_votes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- The end
-- ---------------------------------------------------------------------------

-- Every revealed category of the event in order, with its winners, for a
-- member. A category nobody voted on is one row with no user.
create function public.award_results(target_event_id uuid)
returns table (
  category_id uuid,
  category_position integer,
  category_text text,
  user_id uuid,
  votes integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.position, c.text, w.user_id, w.votes
  from public.award_categories c
  left join private.award_winners(c.event_id) w on w.category_id = c.id
  where c.event_id = target_event_id
    and c.status = 'approved'
    and c.revealed_at is not null
    and public.is_member(target_event_id)
  order by c.position, w.user_id;
$$;

revoke execute on function public.award_results(uuid) from public, anon;
grant execute on function public.award_results(uuid) to authenticated;

-- How many awards each guest won (ties count for everyone tied). The host gets
-- every guest with a name, a guest only their own row, anyone else nothing.
create function public.awards_won(target_event_id uuid)
returns table (user_id uuid, awards integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.user_id,
    (
      select count(*)
      from private.award_winners(target_event_id) w
      where w.user_id = g.user_id
    )::integer
  from public.members g
  where g.event_id = target_event_id
    and g.role = 'guest'
    and g.display_name is not null
    and public.is_member(target_event_id)
    and (public.is_host(target_event_id) or g.user_id = (select auth.uid()))
  order by g.user_id;
$$;

revoke execute on function public.awards_won(uuid) from public, anon;
grant execute on function public.awards_won(uuid) to authenticated;
