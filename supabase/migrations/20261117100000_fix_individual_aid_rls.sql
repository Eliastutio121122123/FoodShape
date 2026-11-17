-- Avoid recursive organization/profile/request RLS evaluation and grant the
-- donation_id column explicitly because the client includes it in each insert.

create or replace function public.is_foodshare_person()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'person'
      and status = 'active'
  );
$$;

revoke all on function public.is_foodshare_person() from public, anon;
grant execute on function public.is_foodshare_person() to authenticated;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select
  on public.organizations for select to authenticated
  using (
    owner_id = (select auth.uid())
    or public.is_foodshare_admin()
    or (organization_type = 'donor' and verification_status = 'approved' and status = 'active')
    or (verification_status = 'approved' and status = 'active' and public.is_foodshare_person())
  );

grant insert (donation_id) on public.individual_aid_requests to authenticated;

-- Organizations may decide only pending aid requests; once answered, the row
-- cannot be changed back or have its decision overwritten through the client.
drop policy if exists individual_aid_org_update on public.individual_aid_requests;
create policy individual_aid_org_update
  on public.individual_aid_requests for update to authenticated
  using (
    status = 'pending'
    and (
      exists (
        select 1 from public.organizations as organization
        where organization.id = organization_id
          and organization.owner_id = (select auth.uid())
      )
      or public.is_foodshare_admin()
    )
  )
  with check (
    status in ('approved', 'rejected')
    and (
      exists (
        select 1 from public.organizations as organization
        where organization.id = organization_id
          and organization.owner_id = (select auth.uid())
      )
      or public.is_foodshare_admin()
    )
  );
