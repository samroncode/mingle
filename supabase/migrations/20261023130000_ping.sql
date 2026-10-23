-- Keep-awake ping. The daily workflow calls this with the publishable key so
-- the database sees real traffic (a free project pauses after 7 days without
-- any). It reads nothing from the app's tables and returns a constant.
create function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$
  select true;
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
