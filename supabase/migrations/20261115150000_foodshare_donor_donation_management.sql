-- Separate publication visibility from workflow status so pending requests can
-- still be reviewed after a donor hides an item from new beneficiaries.
alter table public.donations
  add column if not exists is_visible boolean not null default true;

drop policy if exists donations_select on public.donations;
create policy donations_select
  on public.donations for select to authenticated
  using (
    (status = 'available' and is_visible)
    or public.is_foodshare_admin()
    or exists (
      select 1 from public.organizations as organization
      where organization.id = donor_organization_id
        and organization.owner_id = auth.uid()
    )
  );

drop policy if exists donations_public_read on public.donations;
create policy donations_public_read
  on public.donations for select to anon
  using (status = 'available' and is_visible);

drop policy if exists requests_insert on public.donation_requests;
create policy requests_insert
  on public.donation_requests for insert to authenticated
  with check (
    exists (
      select 1 from public.organizations as beneficiary
      where beneficiary.id = beneficiary_organization_id
        and beneficiary.owner_id = auth.uid()
        and beneficiary.organization_type = 'beneficiary'
        and beneficiary.verification_status = 'approved'
    )
    and exists (
      select 1 from public.donations as donation
      where donation.id = donation_id
        and donation.status = 'available'
        and donation.is_visible
        and donation.expires_at > now()
    )
  );

grant delete on public.donations to authenticated;

create or replace function public.can_delete_foodshare_donation(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.donations as donation
    join public.organizations as organization
      on organization.id = donation.donor_organization_id
    where donation.id = target_donation_id
      and donation.status in ('available', 'expired', 'cancelled')
      and organization.owner_id = auth.uid()
      and organization.organization_type = 'donor'
      and not exists (
        select 1 from public.donation_requests as request
        where request.donation_id = donation.id
      )
  );
$$;

revoke all on function public.can_delete_foodshare_donation(uuid) from public, anon;
grant execute on function public.can_delete_foodshare_donation(uuid) to authenticated;

drop policy if exists donations_delete on public.donations;
create policy donations_delete
  on public.donations for delete to authenticated
  using (public.can_delete_foodshare_donation(id));
