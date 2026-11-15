alter table public.donations
  add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'foodshare-donations',
  'foodshare-donations',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists foodshare_donations_image_read on storage.objects;
create policy foodshare_donations_image_read
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'foodshare-donations');

drop policy if exists foodshare_donations_image_insert on storage.objects;
create policy foodshare_donations_image_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'foodshare-donations'
    and exists (
      select 1 from public.organizations as organization
      where organization.id::text = (storage.foldername(name))[1]
        and organization.owner_id = auth.uid()
        and organization.organization_type = 'donor'
        and organization.status = 'active'
        and organization.verification_status = 'approved'
    )
  );

drop policy if exists foodshare_donations_image_update on storage.objects;
create policy foodshare_donations_image_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'foodshare-donations'
    and exists (
      select 1 from public.organizations as organization
      where organization.id::text = (storage.foldername(name))[1]
        and organization.owner_id = auth.uid()
        and organization.organization_type = 'donor'
    )
  )
  with check (
    bucket_id = 'foodshare-donations'
    and exists (
      select 1 from public.organizations as organization
      where organization.id::text = (storage.foldername(name))[1]
        and organization.owner_id = auth.uid()
        and organization.organization_type = 'donor'
    )
  );

drop policy if exists foodshare_donations_image_delete on storage.objects;
create policy foodshare_donations_image_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'foodshare-donations'
    and exists (
      select 1 from public.organizations as organization
      where organization.id::text = (storage.foldername(name))[1]
        and organization.owner_id = auth.uid()
        and organization.organization_type = 'donor'
    )
  );
