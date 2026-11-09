create or replace function public.can_donor_view_beneficiary(beneficiary_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.donation_requests as req
    join public.donations as donation on donation.id = req.donation_id
    join public.organizations as donor on donor.id = donation.donor_organization_id
    where req.beneficiary_organization_id = $1
      and donor.owner_id = auth.uid()
      and donor.organization_type = 'donor'
  );
$$;

revoke all on function public.can_donor_view_beneficiary(uuid) from public;
grant execute on function public.can_donor_view_beneficiary(uuid) to authenticated;

create policy organizations_beneficiaries_for_donor_requests
  on public.organizations
  for select to authenticated
  using (
    organization_type = 'beneficiary'
    and public.can_donor_view_beneficiary(id)
  );
