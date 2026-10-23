-- Awards spec (#59), ticket #62: the award categories of an event, and
-- `create_event` taking the picked categories.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

-- The limits match AwardCategorySchema in src/lib/schemas/awards.ts. A
-- category is a position in the event's awards (from 0), so the awards flow
-- state (`current_step`) refers to it by that position.
create table public.award_categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  position integer not null check (position between 0 and 19),
  text text not null check (
    char_length(text) between 1 and 120 and btrim(text) <> ''
  ),
  -- Only `approved` categories are ever shown to guests or on the TV;
  -- `draft` is for AI suggestions later.
  status text not null default 'approved'
    check (status in ('draft', 'approved')),
  -- Null until the category is revealed; then its winner is known.
  revealed_at timestamptz,
  -- How many guests have voted, kept by the database so that "7 of 12
  -- voted" needs no access to the votes.
  vote_count integer not null default 0 check (vote_count >= 0),
  unique (event_id, position)
);

-- ---------------------------------------------------------------------------
-- Helper function for the policy
-- ---------------------------------------------------------------------------

-- Whether the caller may read this category. The host reads every category
-- of their event. Other members read an approved category only while the
-- event shows it (awards are on its position with the phase open or
-- revealed) or after it was revealed. `security definer` so that the policy
-- does not depend on what the caller may read in `events`.
create function public.can_read_award_category(
  target_event_id uuid,
  category_position integer,
  category_status text,
  category_revealed_at timestamptz
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_host(target_event_id)
    or (
      public.is_member(target_event_id)
      and category_status = 'approved'
      and (
        category_revealed_at is not null
        or exists (
          select 1
          from public.events e
          where e.id = target_event_id
            and e.current_module = 'awards'
            and e.current_step = category_position
            and e.phase in ('open', 'revealed')
        )
      )
    );
$$;

revoke execute on function public.can_read_award_category(
  uuid, integer, text, timestamptz
) from public, anon;
grant execute on function public.can_read_award_category(
  uuid, integer, text, timestamptz
) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------

-- Take back the default privileges, then grant only reading. No client
-- writes the table: categories are written by host-actions with the service
-- role.
revoke all on public.award_categories from anon, authenticated;

grant select on public.award_categories to authenticated;
alter table public.award_categories enable row level security;

create policy "Members can read the categories they may see"
  on public.award_categories for select
  to authenticated
  using (
    public.can_read_award_category(event_id, position, status, revealed_at)
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

-- Views follow a category being shown, voted on or revealed through it.
alter publication supabase_realtime add table public.award_categories;

-- ---------------------------------------------------------------------------
-- create_event with award categories
-- ---------------------------------------------------------------------------

drop function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb
);

-- As before, plus `awards`: a JSON array of `{ text }`, already validated by
-- host-actions with the shared awards schema, in the order chosen. Each is
-- stored as an approved category at the positions 0, 1, 2, ... in the same
-- transaction as the event.
create function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text,
  quiz jsonb default '[]',
  awards jsonb default '[]'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  new_event_id uuid;
  violated_constraint text;
begin
  begin
    insert into public.events (code, niche, language, enabled_modules, party)
    values (
      create_event.code,
      create_event.niche,
      create_event.language,
      create_event.enabled_modules,
      create_event.party
    )
    returning id into new_event_id;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint = 'events_code_key' then
      return null;
    end if;
    raise;
  end;

  insert into private.event_secrets (event_id, admin_key_hash)
  values (new_event_id, create_event.admin_key_hash);

  insert into public.members (event_id, user_id, role)
  values (new_event_id, caller, 'host');

  with inserted as (
    insert into public.quiz_questions (event_id, position, text, options)
    select
      new_event_id,
      (q.ordinality - 1)::integer,
      q.value ->> 'text',
      array(
        select o.value
        from pg_catalog.jsonb_array_elements_text(q.value -> 'options')
          with ordinality as o(value, ordinality)
        order by o.ordinality
      )
    from pg_catalog.jsonb_array_elements(create_event.quiz)
      with ordinality as q(value, ordinality)
    returning id, position
  )
  insert into public.quiz_answer_keys (question_id, correct)
  select i.id, (q.value ->> 'correct')::integer
  from inserted i
  join pg_catalog.jsonb_array_elements(create_event.quiz)
    with ordinality as q(value, ordinality)
    on i.position = q.ordinality - 1;

  insert into public.award_categories (event_id, position, text)
  select new_event_id, (a.ordinality - 1)::integer, a.value ->> 'text'
  from pg_catalog.jsonb_array_elements(create_event.awards)
    with ordinality as a(value, ordinality);

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb
) to service_role;
