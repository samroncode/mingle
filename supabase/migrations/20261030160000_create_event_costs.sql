-- Shared costs spec (#175), ticket #180: the setup wizard can switch shared
-- costs on, so `create_event` takes them.

drop function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb
);

-- As before (retired codes, quiz, awards and hot takes included), plus
-- `costs`: null, or `{ payeeName, swishNumber, purchases: [{ name, price }] }`
-- already validated by host-actions with the shared schema (the number comes
-- normalised). null stores nothing, so shared costs stay off. Purchases are
-- stored in the order chosen with no sharers: nobody has joined yet, and the
-- host picks who shares each one in the control panel. The same table checks
-- as update_costs apply; a violation fails the call and nothing is stored.
create function public.create_event(
  caller uuid,
  code text,
  niche text,
  language text,
  enabled_modules text[],
  party jsonb,
  admin_key_hash text,
  quiz jsonb default '[]',
  awards jsonb default '[]',
  hottakes jsonb default '[]',
  costs jsonb default null
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

    -- Checked after the insert, as its own statement, so it sees a code that
    -- the cleanup retired while the insert waited for that event's row to go.
    if exists (
      select 1 from private.retired_codes r where r.code = create_event.code
    ) then
      raise unique_violation using constraint = 'retired_codes_pkey';
    end if;
  exception when unique_violation then
    get stacked diagnostics violated_constraint = constraint_name;
    if violated_constraint in ('events_code_key', 'retired_codes_pkey') then
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

  insert into public.hot_takes (event_id, position, text)
  select new_event_id, (h.ordinality - 1)::integer, h.value ->> 'text'
  from pg_catalog.jsonb_array_elements(create_event.hottakes)
    with ordinality as h(value, ordinality);

  if create_event.costs is not null
    and pg_catalog.jsonb_typeof(create_event.costs) = 'object' then
    insert into public.cost_settings (event_id, payee_name, swish_number)
    values (
      new_event_id,
      create_event.costs ->> 'payeeName',
      create_event.costs ->> 'swishNumber'
    );

    insert into public.cost_purchases (event_id, position, name, price_kr)
    select
      new_event_id,
      (c.ordinality - 1)::integer,
      c.value ->> 'name',
      (c.value ->> 'price')::integer
    from pg_catalog.jsonb_array_elements(create_event.costs -> 'purchases')
      with ordinality as c(value, ordinality);
  end if;

  return new_event_id;
end;
$$;

revoke execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.create_event(
  uuid, text, text, text, text[], jsonb, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
