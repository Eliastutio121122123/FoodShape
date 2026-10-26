-- Admin-managed catalog options. Deactivate entries instead of deleting them
-- so historical donations and organization registrations remain readable.

grant insert, update on public.food_categories to authenticated;

create policy categories_admin_insert
  on public.food_categories for insert to authenticated
  with check (public.is_foodshare_admin());
create policy categories_admin_update
  on public.food_categories for update to authenticated
  using (public.is_foodshare_admin())
  with check (public.is_foodshare_admin());
create policy categories_admin_read
  on public.food_categories for select to authenticated
  using (public.is_foodshare_admin());

create table public.organization_categories (
  id uuid primary key default gen_random_uuid(),
  organization_type text not null check (organization_type in ('donor', 'beneficiary')),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index organization_categories_type_name_unique
  on public.organization_categories (organization_type, lower(name));

insert into public.organization_categories (organization_type, name) values
  ('donor', 'Restaurante'),
  ('donor', 'Supermercado'),
  ('donor', 'Hotel'),
  ('beneficiary', 'Comedor comunitario'),
  ('beneficiary', 'Fundacion'),
  ('beneficiary', 'ONG'),
  ('beneficiary', 'Banco de alimentos')
on conflict do nothing;

alter table public.organization_categories enable row level security;

grant select on public.organization_categories to anon, authenticated;
grant insert, update on public.organization_categories to authenticated;

create policy organization_categories_read
  on public.organization_categories for select to anon, authenticated
  using (active);
create policy organization_categories_admin_read
  on public.organization_categories for select to authenticated
  using (public.is_foodshare_admin());
create policy organization_categories_admin_insert
  on public.organization_categories for insert to authenticated
  with check (public.is_foodshare_admin());
create policy organization_categories_admin_update
  on public.organization_categories for update to authenticated
  using (public.is_foodshare_admin())
  with check (public.is_foodshare_admin());
