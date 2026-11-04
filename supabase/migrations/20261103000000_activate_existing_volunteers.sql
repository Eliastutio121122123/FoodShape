-- Volunteers do not require administrative approval. Repair existing accounts
-- that were marked pending when their auth metadata did not include a role.
with activated as (
  update public.profiles
  set status = 'active', updated_at = now()
  where role = 'volunteer' and status = 'pending'
  returning id
)
update public.volunteer_profiles vp
set status = 'available'
from activated
where vp.user_id = activated.id and vp.status = 'inactive';

-- If an account is created without a recognized role in auth metadata, use the
-- safe volunteer role and active status. Donor and beneficiary approvals remain
-- pending through their normal registration flow.
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
  if account_role is null or account_role not in ('donor', 'beneficiary', 'volunteer') then
    account_role := 'volunteer';
  end if;

  if account_role in ('donor', 'beneficiary') then
    profile_status := 'pending';
  end if;

  insert into public.profiles (id, email, full_name, phone, role, status)
  values (new.id, lower(new.email), full_name_val, phone_val, account_role, profile_status)
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone = excluded.phone,
        role = excluded.role,
        status = excluded.status,
        updated_at = now();

  if account_role in ('donor', 'beneficiary') then
    insert into public.organizations (
      owner_id, organization_type, name, rnc, email, phone, address, city,
      representative_name, profile_type
    ) values (
      new.id, account_role,
      coalesce(nullif(trim(m->>'organization_name'), ''), ''),
      nullif(trim(m->>'rnc'), ''), lower(new.email), phone_val,
      coalesce(nullif(trim(m->>'address'), ''), ''),
      coalesce(nullif(trim(m->>'city'), ''), ''),
      coalesce(nullif(trim(m->>'full_name'), ''), full_name_val),
      nullif(trim(m->>'profile_type'), '')
    )
    on conflict (owner_id) do update
      set name = excluded.name,
          rnc = excluded.rnc,
          phone = excluded.phone,
          address = excluded.address,
          city = excluded.city,
          representative_name = excluded.representative_name,
          profile_type = excluded.profile_type,
          updated_at = now();
  else
    insert into public.volunteer_profiles (
      user_id, transport_type, other_transport_type, availability_zone,
      agreement_accepted_at, status
    ) values (
      new.id,
      nullif(trim(coalesce(m->>'transport_type', '')), 'other'),
      nullif(trim(coalesce(m->>'other_transport_type', '')), ''),
      coalesce(nullif(trim(m->>'availability_zone'), ''), ''),
      case when (m->>'agreement_accepted') = 'true' then now() else null end,
      'available'
    )
    on conflict (user_id) do update
      set transport_type = excluded.transport_type,
          other_transport_type = excluded.other_transport_type,
          availability_zone = excluded.availability_zone,
          agreement_accepted_at = coalesce(excluded.agreement_accepted_at, volunteer_profiles.agreement_accepted_at);
  end if;

  return new;
exception
  when others then
    raise warning 'create_foodshare_profile error for user %: % %', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

-- Repair Auth users that existed before the profile trigger was installed or
-- whose profile creation failed. Re-running this script is safe.
insert into public.profiles (id, email, full_name, phone, role, status)
select
  u.id,
  lower(u.email),
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
           nullif(trim(u.raw_user_meta_data->>'name'), ''),
           split_part(u.email, '@', 1)),
  coalesce(nullif(trim(u.raw_user_meta_data->>'phone'), ''), ''),
  case when u.raw_user_meta_data->>'role' in ('donor', 'beneficiary', 'volunteer')
       then u.raw_user_meta_data->>'role' else 'volunteer' end,
  case when u.raw_user_meta_data->>'role' in ('donor', 'beneficiary')
       then 'pending' else 'active' end
from auth.users u
where u.email is not null
on conflict (id) do nothing;

insert into public.volunteer_profiles (
  user_id, transport_type, other_transport_type, availability_zone, status
)
select
  p.id,
  nullif(trim(coalesce(u.raw_user_meta_data->>'transport_type', '')), 'other'),
  nullif(trim(coalesce(u.raw_user_meta_data->>'other_transport_type', '')), ''),
  coalesce(nullif(trim(u.raw_user_meta_data->>'availability_zone'), ''), ''),
  'available'
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'volunteer'
on conflict (user_id) do nothing;
