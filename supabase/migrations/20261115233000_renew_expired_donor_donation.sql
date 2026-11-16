create or replace function public.renew_donor_donation_availability(
  p_donation_id uuid,
  p_pickup_starts_at timestamptz,
  p_pickup_ends_at timestamptz,
  p_food_safe_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  donation_row record;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para actualizar la vigencia.' using errcode = '42501';
  end if;
  if p_food_safe_confirmed is distinct from true then
    raise exception 'Confirma que el alimento sigue apto para consumo.' using errcode = '22023';
  end if;
  if p_pickup_starts_at is null or p_pickup_ends_at is null
     or p_pickup_starts_at <= now() or p_pickup_ends_at <= p_pickup_starts_at then
    raise exception 'Indica un horario futuro válido.' using errcode = '22023';
  end if;

  select donation.id, donation.status, donation.expires_at
    into donation_row
    from public.donations as donation
    join public.organizations as donor on donor.id = donation.donor_organization_id
   where donation.id = p_donation_id
     and donor.owner_id = auth.uid()
     and donor.organization_type = 'donor'
     and donor.status = 'active'
     and donor.verification_status = 'approved'
   for update of donation;

  if not found then
    raise exception 'No encontramos una donación activa de tu organización.' using errcode = 'P0002';
  end if;
  if donation_row.status <> 'available' or donation_row.expires_at > now() then
    raise exception 'Solo puedes renovar una donación disponible cuya vigencia ya venció.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.donation_requests as request
     where request.donation_id = p_donation_id and request.status = 'pending'
  ) or exists (
    select 1 from public.donation_requests as request
     where request.donation_id = p_donation_id and request.status = 'accepted'
  ) then
    raise exception 'La donación debe tener solicitudes pendientes y ninguna aceptada.' using errcode = '22023';
  end if;

  update public.donations
     set pickup_starts_at = p_pickup_starts_at,
         pickup_ends_at = p_pickup_ends_at,
         expires_at = p_pickup_ends_at,
         updated_at = now()
   where id = p_donation_id;
end;
$$;

revoke all on function public.renew_donor_donation_availability(uuid, timestamptz, timestamptz, boolean) from public, anon;
grant execute on function public.renew_donor_donation_availability(uuid, timestamptz, timestamptz, boolean) to authenticated;
