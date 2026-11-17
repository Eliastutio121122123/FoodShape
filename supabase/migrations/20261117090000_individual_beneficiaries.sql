-- Personal beneficiaries can find verified organizations and request membership or a food ration.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'donor', 'beneficiary', 'volunteer', 'person'));

create or replace function public.create_foodshare_profile()
returns trigger language plpgsql security definer set search_path = public, extensions
as $$
declare
  m jsonb := new.raw_user_meta_data;
  account_role text := m->>'role';
  profile_status text := 'active';
  phone_val text := coalesce(nullif(trim(m->>'phone'), ''), '');
  full_name_val text := coalesce(nullif(trim(m->>'full_name'), ''), m->>'name', split_part(new.email, '@', 1));
begin
  if account_role is null or account_role not in ('donor', 'beneficiary', 'volunteer', 'person') then
    account_role := 'volunteer';
  end if;
  if account_role in ('donor', 'beneficiary') then profile_status := 'pending'; end if;

  insert into public.profiles (id, email, full_name, phone, role, status)
  values (new.id, lower(new.email), full_name_val, phone_val, account_role, profile_status)
  on conflict (id) do update set full_name = excluded.full_name, phone = excluded.phone,
    role = excluded.role, status = excluded.status, updated_at = now();

  if account_role in ('donor', 'beneficiary') then
    insert into public.organizations (owner_id, organization_type, name, rnc, email, phone, address, city, representative_name, profile_type)
    values (new.id, account_role, coalesce(nullif(trim(m->>'organization_name'), ''), ''),
      nullif(trim(m->>'rnc'), ''), lower(new.email), phone_val,
      coalesce(nullif(trim(m->>'address'), ''), ''), coalesce(nullif(trim(m->>'city'), ''), ''),
      coalesce(nullif(trim(m->>'full_name'), ''), full_name_val), nullif(trim(m->>'profile_type'), ''))
    on conflict (owner_id) do update set name = excluded.name, rnc = excluded.rnc, phone = excluded.phone,
      address = excluded.address, city = excluded.city, representative_name = excluded.representative_name,
      profile_type = excluded.profile_type, updated_at = now();
  elsif account_role = 'volunteer' then
    insert into public.volunteer_profiles (user_id, transport_type, other_transport_type, availability_zone, agreement_accepted_at, status)
    values (new.id, nullif(trim(coalesce(m->>'transport_type', '')), 'other'),
      nullif(trim(coalesce(m->>'other_transport_type', '')), ''), coalesce(nullif(trim(m->>'availability_zone'), ''), ''),
      case when m->>'agreement_accepted' = 'true' then now() else null end, 'available')
    on conflict (user_id) do update set transport_type = excluded.transport_type,
      other_transport_type = excluded.other_transport_type, availability_zone = excluded.availability_zone;
  end if;
  return new;
exception when others then
  raise warning 'create_foodshare_profile error for user %: % %', new.id, sqlerrm, sqlstate;
  return new;
end;
$$;

drop policy if exists organizations_select on public.organizations;
create policy organizations_select on public.organizations for select to authenticated
using (
  owner_id = auth.uid() or public.is_foodshare_admin()
  or (organization_type = 'donor' and verification_status = 'approved' and status = 'active')
  or (verification_status = 'approved' and status = 'active' and exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'person' and p.status = 'active'
  ))
);

create table public.individual_aid_requests (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  donation_id uuid references public.donations(id) on delete set null,
  request_type text not null check (request_type in ('membership', 'ration')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  preferred_date date,
  scheduled_at timestamptz,
  message text,
  response_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (request_type = 'ration' or (preferred_date is null and scheduled_at is null))
);
create unique index individual_aid_one_membership on public.individual_aid_requests(person_id, organization_id)
  where request_type = 'membership' and status in ('pending', 'approved');
create index individual_aid_person_recent on public.individual_aid_requests(person_id, created_at desc);
create index individual_aid_org_recent on public.individual_aid_requests(organization_id, status, created_at desc);
alter table public.individual_aid_requests enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (
  id = auth.uid() or public.is_foodshare_admin() or exists (
    select 1 from public.individual_aid_requests r join public.organizations o on o.id = r.organization_id
    where r.person_id = profiles.id and o.owner_id = auth.uid()
  )
);
grant select on public.individual_aid_requests to authenticated;
grant insert(person_id, organization_id, request_type, preferred_date, message) on public.individual_aid_requests to authenticated;
grant update(status, scheduled_at, response_message) on public.individual_aid_requests to authenticated;
create policy individual_aid_read on public.individual_aid_requests for select to authenticated
using (person_id = auth.uid() or exists (
  select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid()
) or public.is_foodshare_admin());
create policy individual_aid_insert on public.individual_aid_requests for insert to authenticated
with check (
  person_id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'person' and p.status = 'active')
  and exists (select 1 from public.organizations o where o.id = organization_id
    and o.verification_status = 'approved' and o.status = 'active')
  and (donation_id is null or exists (select 1 from public.donations d where d.id = donation_id
    and d.donor_organization_id = organization_id and d.status = 'available' and d.expires_at > now()))
);
create policy individual_aid_org_update on public.individual_aid_requests for update to authenticated
using (exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid()) or public.is_foodshare_admin())
with check (exists (select 1 from public.organizations o where o.id = organization_id and o.owner_id = auth.uid()) or public.is_foodshare_admin());

create policy individual_aid_person_donation_read on public.donations for select to authenticated
using (exists (select 1 from public.individual_aid_requests r where r.donation_id = donations.id and r.person_id = auth.uid()));

create or replace function public.notify_organization_of_individual_aid_request()
returns trigger language plpgsql security definer set search_path = public
as $$
declare org_owner uuid; person_name text;
begin
  select owner_id into org_owner from public.organizations where id = new.organization_id;
  select full_name into person_name from public.profiles where id = new.person_id;
  if org_owner is not null then
    insert into public.notifications(user_id, title, message)
    values (org_owner, case when new.request_type = 'membership' then 'Solicitud para unirse' else 'Solicitud de ración de alimentos' end,
      coalesce(person_name, 'Una persona') || ' te envió una solicitud. Revisa las solicitudes de apoyo.');
  end if;
  return new;
end;
$$;
create trigger individual_aid_notify_org after insert on public.individual_aid_requests
for each row execute function public.notify_organization_of_individual_aid_request();
