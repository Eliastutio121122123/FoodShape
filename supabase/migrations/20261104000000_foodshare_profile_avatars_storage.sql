-- Store profile photos in Supabase Storage instead of Auth metadata.
alter table public.profiles
  add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foodshare-avatars', 'foodshare-avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists foodshare_avatars_read_own on storage.objects;
create policy foodshare_avatars_read_own
  on storage.objects for select to authenticated
  using (
    bucket_id = 'foodshare-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists foodshare_avatars_insert_own on storage.objects;
create policy foodshare_avatars_insert_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'foodshare-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists foodshare_avatars_update_own on storage.objects;
create policy foodshare_avatars_update_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'foodshare-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'foodshare-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists foodshare_avatars_delete_own on storage.objects;
create policy foodshare_avatars_delete_own
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'foodshare-avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
