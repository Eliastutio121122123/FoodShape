-- Break the profiles <-> individual_aid_requests RLS cycle. The helper is in an
-- unexposed schema and only returns true to an organization owner who has an
-- individual aid request from this person to that organization.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_organization_view_aid_person(target_person_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.individual_aid_requests as request
    join public.organizations as organization on organization.id = request.organization_id
    where request.person_id = target_person_id
      and organization.owner_id = (select auth.uid())
  );
$$;

revoke all on function private.can_organization_view_aid_person(uuid) from public, anon, authenticated;
grant execute on function private.can_organization_view_aid_person(uuid) to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.is_foodshare_admin())
    or (select private.can_organization_view_aid_person(id))
  );
