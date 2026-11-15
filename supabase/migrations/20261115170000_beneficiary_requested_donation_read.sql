-- Let a beneficiary read the safe donation details for its own requests after
-- the donor accepts and reserves the donation. The UI only reveals pickup
-- address details after acceptance; no other organization's requests qualify.
create or replace function public.can_beneficiary_view_requested_donation(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.donation_requests as request
      join public.organizations as beneficiary
        on beneficiary.id = request.beneficiary_organization_id
     where request.donation_id = target_donation_id
       and request.status = 'accepted'
       and beneficiary.owner_id = auth.uid()
       and beneficiary.organization_type = 'beneficiary'
  );
$$;

revoke all on function public.can_beneficiary_view_requested_donation(uuid) from public, anon;
grant execute on function public.can_beneficiary_view_requested_donation(uuid) to authenticated;

drop policy if exists donations_beneficiary_own_accepted_request on public.donations;
create policy donations_beneficiary_own_accepted_request
  on public.donations for select to authenticated
  using (public.can_beneficiary_view_requested_donation(id));
