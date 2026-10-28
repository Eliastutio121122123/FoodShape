-- Fix: rewrite create_foodshare_profile trigger to handle errors gracefully
-- and ensure phone, profile_type and all metadata fields are saved correctly.

create or replace function public.create_foodshare_profile()
returns trigger language plpgsql security definer set search_path = public, extensions
as $$
declare
  m              jsonb    := new.raw_user_meta_data;
  account_role   text     := m->>'role';
  profile_status text     := 'active';
  phone_val      text     := coalesce(nullif(trim(m->>'phone'), ''), '');
  full_name_val  text     := coalesce(nullif(trim(m->>'full_name'), ''), m->>'name', split_part(new.email, '@', 1));
begin
  -- Validate role; fall back to pending volunteer if unknown
  if account_role is null or account_role not in ('donor', 'beneficiary', 'volunteer') then
    account_role   := 'volunteer';
    profile_status := 'pending';
  end if;

  -- Upsert profile (handles re-runs safely)
  insert into public.profiles (id, email, full_name, phone, role, status)
  values (
    new.id,
    lower(new.email),
    full_name_val,
    phone_val,
    account_role,
    profile_status
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        phone     = excluded.phone,
        role      = excluded.role,
        status    = excluded.status,
        updated_at = now();

  if account_role in ('donor', 'beneficiary') then
    insert into public.organizations (
      owner_id, organization_type, name, rnc, email,
      phone, address, city, representative_name, profile_type
    ) values (
      new.id,
      account_role,
      coalesce(nullif(trim(m->>'organization_name'), ''), ''),
      nullif(trim(m->>'rnc'), ''),
      lower(new.email),
      phone_val,
      coalesce(nullif(trim(m->>'address'), ''), ''),
      coalesce(nullif(trim(m->>'city'), ''), ''),
      coalesce(nullif(trim(m->>'full_name'), ''), full_name_val),
      nullif(trim(m->>'profile_type'), '')
    )
    on conflict (owner_id) do update
      set name                = excluded.name,
          rnc                 = excluded.rnc,
          phone               = excluded.phone,
          address             = excluded.address,
          city                = excluded.city,
          representative_name = excluded.representative_name,
          profile_type        = excluded.profile_type,
          updated_at          = now();

  else
    -- volunteer
    insert into public.volunteer_profiles (
      user_id, transport_type, other_transport_type,
      availability_zone, agreement_accepted_at, status
    ) values (
      new.id,
      nullif(trim(coalesce(m->>'transport_type', '')), 'other'),
      nullif(trim(coalesce(m->>'other_transport_type', '')), ''),
      coalesce(nullif(trim(m->>'availability_zone'), ''), ''),
      case when (m->>'agreement_accepted') = 'true' then now() else null end,
      case when profile_status = 'pending' then 'inactive' else 'available' end
    )
    on conflict (user_id) do update
      set transport_type       = excluded.transport_type,
          other_transport_type = excluded.other_transport_type,
          availability_zone    = excluded.availability_zone,
          agreement_accepted_at = coalesce(excluded.agreement_accepted_at, volunteer_profiles.agreement_accepted_at),
          status               = excluded.status;
  end if;

  return new;
exception
  when others then
    -- Log error to postgres log but do not block auth user creation
    raise warning 'create_foodshare_profile error for user %: % %', new.id, sqlerrm, sqlstate;
    return new;
end;
$$;

-- Recreate trigger (drop+create to pick up the new function signature)
drop trigger if exists on_foodshare_auth_user_created on auth.users;
create trigger on_foodshare_auth_user_created
  after insert on auth.users
  for each row execute function public.create_foodshare_profile();
