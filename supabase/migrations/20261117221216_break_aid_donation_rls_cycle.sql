-- Avoid the reverse RLS cycle from donations back to individual aid requests.
-- A personal requester may see the donation tied to their own aid request.
create or replace function private.can_person_view_requested_donation(target_donation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.individual_aid_requests as request
    where request.donation_id = target_donation_id
      and request.person_id = (select auth.uid())
  );
$$;

revoke all on function private.can_person_view_requested_donation(uuid) from public, anon, authenticated;
grant execute on function private.can_person_view_requested_donation(uuid) to authenticated;

drop policy if exists individual_aid_person_donation_read on public.donations;
create policy individual_aid_person_donation_read
  on public.donations for select to authenticated
  using ((select private.can_person_view_requested_donation(id)));
