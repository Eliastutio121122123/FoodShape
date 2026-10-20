-- FoodShare Supabase/PostgreSQL schema.
create extension if not exists pgcrypto with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique, full_name text not null, phone text not null default '',
  role text not null check (role in ('admin','donor','beneficiary','volunteer')),
  status text not null default 'active' check (status in ('active','inactive','pending')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null unique references public.profiles(id) on delete cascade,
  organization_type text not null check (organization_type in ('donor','beneficiary')),
  name text not null, rnc text, email text not null, phone text not null, address text not null, city text not null,
  representative_name text not null, profile_type text,
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index organizations_rnc_unique on public.organizations(rnc) where rnc is not null and rnc <> '';
create table public.volunteer_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade, transport_type text, other_transport_type text,
  availability_zone text not null default '', agreement_accepted_at timestamptz,
  status text not null default 'available' check (status in ('available','assigned','inactive'))
);
create table public.food_categories (id uuid primary key default gen_random_uuid(), name text not null unique, active boolean not null default true);
insert into public.food_categories(name) values ('Panadería'),('Frutas'),('Verduras'),('Lácteos'),('Comidas preparadas'),('Productos no perecederos') on conflict do nothing;
create table public.donations (
  id uuid primary key default gen_random_uuid(), donor_organization_id uuid not null references public.organizations(id),
  food_name text not null, category_id uuid references public.food_categories(id), quantity numeric(12,2) not null check(quantity>0), unit text not null,
  expires_at timestamptz not null, pickup_starts_at timestamptz not null, pickup_ends_at timestamptz not null,
  address text not null, city text not null, latitude numeric(9,6), longitude numeric(9,6), notes text,
  status text not null default 'available' check(status in ('available','reserved','pickup_in_progress','picked_up','delivered','expired','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(pickup_ends_at>=pickup_starts_at)
);
create table public.donation_requests (
  id uuid primary key default gen_random_uuid(), donation_id uuid not null references public.donations(id),
  beneficiary_organization_id uuid not null references public.organizations(id),
  status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
  requested_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(donation_id,beneficiary_organization_id)
);
create table public.deliveries (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references public.donation_requests(id),
  volunteer_id uuid references public.volunteer_profiles(user_id), pickup_at timestamptz, delivered_at timestamptz,
  status text not null default 'pending' check(status in ('pending','assigned','pickup_in_progress','picked_up','delivered','cancelled')),
  notes text, created_at timestamptz not null default now()
);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade, title text not null, message text not null, read_at timestamptz, created_at timestamptz not null default now());
create table public.incidents (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references public.profiles(id), donation_id uuid references public.donations(id), description text not null, status text not null default 'open' check(status in ('open','in_review','resolved','dismissed')), created_at timestamptz not null default now());
create table public.reputations (id uuid primary key default gen_random_uuid(), reviewer_id uuid not null references public.profiles(id), target_user_id uuid not null references public.profiles(id), delivery_id uuid references public.deliveries(id), score smallint not null check(score between 1 and 5), comment text, created_at timestamptz not null default now());
create table public.platform_settings (key text primary key, value jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

create or replace function public.is_foodshare_admin() returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') $$;
create or replace function public.profiles_role_matches(profile_id uuid, requested_role text) returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=profile_id and role=requested_role and id=auth.uid()) $$;

create or replace function public.create_foodshare_profile() returns trigger language plpgsql security definer set search_path=public,extensions
as $$
declare m jsonb := new.raw_user_meta_data; account_role text := m->>'role'; profile_status text := 'active';
begin
  if account_role is null or account_role not in ('donor','beneficiary','volunteer') then account_role := 'volunteer'; profile_status := 'pending'; end if;
  insert into public.profiles(id,email,full_name,phone,role,status) values(new.id,lower(new.email),coalesce(nullif(m->>'full_name',''),m->>'name',split_part(new.email,'@',1)),coalesce(m->>'phone',''),account_role,profile_status);
  if account_role in ('donor','beneficiary') then
    insert into public.organizations(owner_id,organization_type,name,rnc,email,phone,address,city,representative_name,profile_type)
    values(new.id,account_role,coalesce(m->>'organization_name',''),nullif(m->>'rnc',''),lower(new.email),coalesce(m->>'phone',''),coalesce(m->>'address',''),coalesce(m->>'city',''),coalesce(m->>'full_name',''),nullif(m->>'profile_type',''));
  else
    insert into public.volunteer_profiles(user_id,transport_type,other_transport_type,availability_zone,agreement_accepted_at,status)
    values(new.id,nullif(m->>'transport_type','other'),nullif(m->>'other_transport_type',''),coalesce(m->>'availability_zone',''),case when m->>'agreement_accepted'='true' then now() else null end,case when profile_status='pending' then 'inactive' else 'available' end);
  end if;
  return new;
end;
$$;
drop trigger if exists on_foodshare_auth_user_created on auth.users;
create trigger on_foodshare_auth_user_created after insert on auth.users for each row execute function public.create_foodshare_profile();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.volunteer_profiles enable row level security;
alter table public.food_categories enable row level security;
alter table public.donations enable row level security;
alter table public.donation_requests enable row level security;
alter table public.deliveries enable row level security;
alter table public.notifications enable row level security;
alter table public.incidents enable row level security;
alter table public.reputations enable row level security;
alter table public.platform_settings enable row level security;

grant select on public.profiles to authenticated;
grant update(full_name,phone) on public.profiles to authenticated;
grant select,insert,update on public.organizations to authenticated;
grant select,insert,update on public.volunteer_profiles to authenticated;
grant select on public.food_categories to anon,authenticated;
grant select on public.donations to anon;
grant select,insert,update on public.donations,public.donation_requests,public.deliveries,public.notifications,public.incidents to authenticated;
grant select,insert on public.reputations to authenticated;
grant select,update on public.platform_settings to authenticated;

create policy profiles_select on public.profiles for select to authenticated using(id=auth.uid() or public.is_foodshare_admin());
create policy profiles_update on public.profiles for update to authenticated using(id=auth.uid() or public.is_foodshare_admin()) with check(id=auth.uid() or public.is_foodshare_admin());
create policy organizations_select on public.organizations for select to authenticated using(owner_id=auth.uid() or public.is_foodshare_admin() or (organization_type='donor' and verification_status='approved' and status='active'));
create policy organizations_insert on public.organizations for insert to authenticated with check(owner_id=auth.uid() and public.profiles_role_matches(owner_id,organization_type));
create policy organizations_admin_update on public.organizations for update to authenticated using(public.is_foodshare_admin()) with check(public.is_foodshare_admin());
create policy volunteers_select on public.volunteer_profiles for select to authenticated using(user_id=auth.uid() or public.is_foodshare_admin());
create policy volunteers_insert on public.volunteer_profiles for insert to authenticated with check(user_id=auth.uid());
create policy volunteers_update on public.volunteer_profiles for update to authenticated using(user_id=auth.uid() or public.is_foodshare_admin()) with check(user_id=auth.uid() or public.is_foodshare_admin());
create policy categories_read on public.food_categories for select to anon,authenticated using(active);
create policy donations_select on public.donations for select to authenticated using(status='available' or public.is_foodshare_admin() or exists(select 1 from public.organizations o where o.id=donor_organization_id and o.owner_id=auth.uid()));
create policy donations_public_read on public.donations for select to anon using(status='available');
create policy donations_insert on public.donations for insert to authenticated with check(exists(select 1 from public.organizations o where o.id=donor_organization_id and o.owner_id=auth.uid() and o.organization_type='donor' and o.verification_status='approved'));
create policy donations_update on public.donations for update to authenticated using(public.is_foodshare_admin() or exists(select 1 from public.organizations o where o.id=donor_organization_id and o.owner_id=auth.uid())) with check(public.is_foodshare_admin() or exists(select 1 from public.organizations o where o.id=donor_organization_id and o.owner_id=auth.uid()));
create policy requests_read on public.donation_requests for select to authenticated using(public.is_foodshare_admin() or exists(select 1 from public.organizations o where o.id=beneficiary_organization_id and o.owner_id=auth.uid()) or exists(select 1 from public.donations d join public.organizations o on o.id=d.donor_organization_id where d.id=donation_id and o.owner_id=auth.uid()));
create policy requests_insert on public.donation_requests for insert to authenticated with check(exists(select 1 from public.organizations o where o.id=beneficiary_organization_id and o.owner_id=auth.uid() and o.organization_type='beneficiary' and o.verification_status='approved'));
create policy requests_update on public.donation_requests for update to authenticated using(public.is_foodshare_admin() or exists(select 1 from public.organizations o where o.id=beneficiary_organization_id and o.owner_id=auth.uid()) or exists(select 1 from public.donations d join public.organizations o on o.id=d.donor_organization_id where d.id=donation_id and o.owner_id=auth.uid()));
create policy deliveries_read on public.deliveries for select to authenticated using(public.is_foodshare_admin() or volunteer_id=auth.uid() or exists(select 1 from public.donation_requests r join public.organizations o on o.id=r.beneficiary_organization_id where r.id=request_id and o.owner_id=auth.uid()) or exists(select 1 from public.donation_requests r join public.donations d on d.id=r.donation_id join public.organizations o on o.id=d.donor_organization_id where r.id=request_id and o.owner_id=auth.uid()));
create policy deliveries_admin_insert on public.deliveries for insert to authenticated with check(public.is_foodshare_admin());
create policy deliveries_update on public.deliveries for update to authenticated using(public.is_foodshare_admin() or volunteer_id=auth.uid()) with check(public.is_foodshare_admin() or volunteer_id=auth.uid());
create policy notifications_own on public.notifications for all to authenticated using(user_id=auth.uid() or public.is_foodshare_admin()) with check(user_id=auth.uid() or public.is_foodshare_admin());
create policy incidents_own_admin on public.incidents for all to authenticated using(reporter_id=auth.uid() or public.is_foodshare_admin()) with check(reporter_id=auth.uid() or public.is_foodshare_admin());
create policy reputations_read on public.reputations for select to authenticated using(true);
create policy reputations_insert on public.reputations for insert to authenticated with check(reviewer_id=auth.uid());
create policy settings_admin on public.platform_settings for all to authenticated using(public.is_foodshare_admin()) with check(public.is_foodshare_admin());
