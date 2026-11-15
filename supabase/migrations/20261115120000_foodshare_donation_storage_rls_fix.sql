-- Keep the storage insert check independent from organizations table RLS.
-- The helper only allows an approved, active donor to write under its own folder.
create or replace function public.can_upload_foodshare_donation_image(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.organizations as organization
    where organization.id::text = (storage.foldername(object_name))[1]
      and organization.owner_id = auth.uid()
      and organization.organization_type = 'donor'
      and organization.status = 'active'
      and organization.verification_status = 'approved'
  );
$$;

revoke all on function public.can_upload_foodshare_donation_image(text) from public, anon;
grant execute on function public.can_upload_foodshare_donation_image(text) to authenticated;

drop policy if exists foodshare_donations_image_insert on storage.objects;
create policy foodshare_donations_image_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'foodshare-donations'
    and public.can_upload_foodshare_donation_image(name)
  );
