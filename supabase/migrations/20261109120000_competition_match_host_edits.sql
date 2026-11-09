-- Competitions spec (#262), ticket #265: the host fixes and deletes matches.
--
-- Two functions, called by host-actions only after the admin key check. Both
-- lock the event first, like the competition functions of 20261109100000, so
-- an edit can't slip in after the evening ends. A match of another event is
-- `unknown`, the same answer as a match that doesn't exist.

-- Corrects who won and the score of a match. The players stay the same two
-- guests (a wrong winner is fixed by naming the other player), so the
-- reporter keeps being one of them. Both scores are null, or both are given,
-- and the winner's is the higher one. Answers, changing nothing:
--   'not_found'      the event doesn't exist or has expired
--   'ended'          the event has ended
--   'disabled'       the event has Competitions switched off
--   'unknown'        no such match in this event
--   'invalid_winner' the new winner isn't one of the match's two players
--   'invalid_score'  one score only, or a score outside 0 to 999
--   'score_mismatch' the winner's score isn't higher than the loser's
-- 'edited' once written.
create function public.edit_match(
  target_event_id uuid,
  match_id uuid,
  new_winner uuid,
  new_winner_score integer default null,
  new_loser_score integer default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  refusal text;
  current_match public.competition_matches%rowtype;
  new_loser uuid;
begin
  refusal := private.lock_event_for_competitions(
    edit_match.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  select m.* into current_match
  from public.competition_matches m
  where m.id = edit_match.match_id
    and m.event_id = edit_match.target_event_id
  for update;
  if not found then
    return 'unknown';
  end if;

  if edit_match.new_winner = current_match.winner_id then
    new_loser := current_match.loser_id;
  elsif edit_match.new_winner = current_match.loser_id then
    new_loser := current_match.winner_id;
  else
    return 'invalid_winner';
  end if;

  if (edit_match.new_winner_score is null)
      <> (edit_match.new_loser_score is null)
    or edit_match.new_winner_score not between 0 and 999
    or edit_match.new_loser_score not between 0 and 999 then
    return 'invalid_score';
  end if;
  if edit_match.new_winner_score <= edit_match.new_loser_score then
    return 'score_mismatch';
  end if;

  update public.competition_matches m
  set winner_id = edit_match.new_winner,
      loser_id = new_loser,
      winner_score = edit_match.new_winner_score,
      loser_score = edit_match.new_loser_score
  where m.id = current_match.id;

  return 'edited';
end;
$$;

revoke execute on function public.edit_match(uuid, uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.edit_match(uuid, uuid, uuid, integer, integer)
  to service_role;

-- Deletes a match. Answers, changing nothing: 'not_found', 'ended',
-- 'disabled' (as above) and 'unknown'. 'deleted' once written.
create function public.delete_match(
  target_event_id uuid,
  match_id uuid
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
  refusal := private.lock_event_for_competitions(
    delete_match.target_event_id
  );
  if refusal is not null then
    return refusal;
  end if;

  delete from public.competition_matches m
  where m.id = delete_match.match_id
    and m.event_id = delete_match.target_event_id;
  if not found then
    return 'unknown';
  end if;

  return 'deleted';
end;
$$;

revoke execute on function public.delete_match(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_match(uuid, uuid) to service_role;
