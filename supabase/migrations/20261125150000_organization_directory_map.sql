-- Public, verified organization locations for the individual support directory.
alter table public.organizations
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists location_precision text not null default 'unknown';

alter table public.organizations
  add constraint organizations_location_precision_check
    check (location_precision in ('address', 'city', 'unknown')),
  add constraint organizations_location_pair_check
    check ((latitude is null) = (longitude is null)),
  add constraint organizations_location_bounds_check
    check (latitude is null or (latitude between 17 and 20 and longitude between -72 and -68.2));

-- Registration geocodes only the address submitted by the organization. Invalid
-- or untrusted metadata is ignored; location is never guessed in this trigger.
create or replace function public.create_foodshare_profile()
returns trigger language plpgsql security definer set search_path = public, extensions
as $$
declare
  m jsonb := new.raw_user_meta_data;
  account_role text := m->>'role';
  profile_status text := 'active';
  phone_val text := coalesce(nullif(trim(m->>'phone'), ''), '');
  full_name_val text := coalesce(nullif(trim(m->>'full_name'), ''), m->>'name', split_part(new.email, '@', 1));
  organization_latitude numeric;
  organization_longitude numeric;
  location_precision_val text := 'unknown';
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
    begin
      organization_latitude := nullif(trim(m->>'organization_latitude'), '')::numeric;
      organization_longitude := nullif(trim(m->>'organization_longitude'), '')::numeric;
      if organization_latitude is null or organization_longitude is null
        or organization_latitude not between 17 and 20 or organization_longitude not between -72 and -68.2 then
        organization_latitude := null;
        organization_longitude := null;
      else
        location_precision_val := case when m->>'organization_location_precision' in ('address', 'city')
          then m->>'organization_location_precision' else 'address' end;
      end if;
    exception when others then
      organization_latitude := null;
      organization_longitude := null;
    end;
    insert into public.organizations (owner_id, organization_type, name, rnc, email, phone, address, city, representative_name, profile_type, latitude, longitude, location_precision)
    values (new.id, account_role, coalesce(nullif(trim(m->>'organization_name'), ''), ''),
      nullif(trim(m->>'rnc'), ''), lower(new.email), phone_val,
      coalesce(nullif(trim(m->>'address'), ''), ''), coalesce(nullif(trim(m->>'city'), ''), ''),
      coalesce(nullif(trim(m->>'full_name'), ''), full_name_val), nullif(trim(m->>'profile_type'), ''),
      organization_latitude, organization_longitude, location_precision_val)
    on conflict (owner_id) do update set name = excluded.name, rnc = excluded.rnc, phone = excluded.phone,
      address = excluded.address, city = excluded.city, representative_name = excluded.representative_name,
      profile_type = excluded.profile_type, latitude = excluded.latitude, longitude = excluded.longitude,
      location_precision = excluded.location_precision, updated_at = now();
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

-- This narrow RPC exposes only directory fields, only to an active person
-- account, and only for verified/active organizations. It deliberately omits
-- email, RNC and representative data. Keep a fixed search_path because this is
-- SECURITY DEFINER.
create or replace function public.get_person_organization_map_directory()
returns table (
  id uuid,
  name text,
  organization_type text,
  profile_type text,
  address text,
  city text,
  phone text,
  latitude numeric,
  longitude numeric,
  location_precision text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization.id, organization.name, organization.organization_type, organization.profile_type,
    organization.address, organization.city, organization.phone, organization.latitude,
    organization.longitude, organization.location_precision
  from public.organizations as organization
  where public.is_foodshare_person()
    and organization.verification_status = 'approved'
    and organization.status = 'active'
  order by organization.name;
$$;

revoke all on function public.get_person_organization_map_directory() from public, anon;
grant execute on function public.get_person_organization_map_directory() to authenticated;

comment on column public.organizations.latitude is 'Geocoded organization location. Null when location could not be determined.';
comment on column public.organizations.longitude is 'Geocoded organization location. Null when location could not be determined.';
comment on column public.organizations.location_precision is 'address: matched address; city: approximate city center; unknown: no safe map position.';
