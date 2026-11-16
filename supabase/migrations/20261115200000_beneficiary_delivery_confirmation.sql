-- Keep acceptance and delivery creation atomic, then let only the beneficiary
-- organization confirm receipt. Donors can read the confirmation but cannot set it.
alter table public.deliveries
  add column if not exists received_confirmed_at timestamptz,
  add column if not exists received_confirmed_by uuid references public.profiles(id);

-- Older accepted requests did not create delivery rows. Backfill those records
-- so they can continue through the same tracking and confirmation flow.
insert into public.deliveries (request_id, status, pickup_at)
select request.id, 'pending', donation.pickup_starts_at
  from public.donation_requests as request
  join public.donations as donation on donation.id = request.donation_id
 where request.status = 'accepted'
on conflict (request_id) do nothing;

create or replace function public.review_donation_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row record;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para revisar la solicitud.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'La decisión de revisión no es válida.' using errcode = '22023';
  end if;

  select req.id, req.donation_id, req.status as request_status,
         req.quantity_requested, donation.quantity as donation_quantity,
         donation.status as donation_status, donation.expires_at,
         donation.pickup_starts_at
    into request_row
    from public.donation_requests as req
    join public.donations as donation on donation.id = req.donation_id
    join public.organizations as donor on donor.id = donation.donor_organization_id
   where req.id = p_request_id
     and donor.owner_id = auth.uid()
     and donor.organization_type = 'donor'
     and donor.status = 'active'
     and donor.verification_status = 'approved'
   for update of req, donation;

  if not found then
    raise exception 'No se encontró la solicitud de tu organización.' using errcode = 'P0002';
  end if;
  if request_row.request_status <> 'pending' then
    raise exception 'Esta solicitud ya fue revisada.' using errcode = '40001';
  end if;

  if p_decision = 'accepted' then
    if request_row.donation_status <> 'available' or request_row.expires_at <= now() then
      raise exception 'La donación ya no está disponible para aceptar solicitudes.' using errcode = '22023';
    end if;
    if request_row.quantity_requested is not null and request_row.quantity_requested > request_row.donation_quantity then
      raise exception 'La cantidad solicitada supera la cantidad publicada.' using errcode = '22023';
    end if;

    update public.donations
       set status = 'reserved', updated_at = now()
     where id = request_row.donation_id;
    update public.donation_requests
       set status = 'accepted', updated_at = now()
     where id = p_request_id;
    update public.donation_requests
       set status = 'rejected', updated_at = now()
     where donation_id = request_row.donation_id
       and id <> p_request_id
       and status = 'pending';
    insert into public.deliveries (request_id, status, pickup_at)
    values (p_request_id, 'pending', request_row.pickup_starts_at)
    on conflict (request_id) do nothing;
  else
    update public.donation_requests
       set status = 'rejected', updated_at = now()
     where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.review_donation_request(uuid, text) from public;
grant execute on function public.review_donation_request(uuid, text) to authenticated;

-- Direct updates must not set delivery completion or beneficiary confirmation.
-- State changes for requests go through the donor-owned SECURITY DEFINER RPC.
revoke update on public.donation_requests from authenticated;

revoke update on public.deliveries from authenticated;
grant update(status, pickup_at, notes) on public.deliveries to authenticated;
drop policy if exists deliveries_update on public.deliveries;
create policy deliveries_update
  on public.deliveries for update to authenticated
  using (public.is_foodshare_admin() or volunteer_id = auth.uid())
  with check (
    public.is_foodshare_admin()
    or (
      volunteer_id = auth.uid()
      and status in ('pending', 'assigned', 'pickup_in_progress', 'picked_up', 'cancelled')
      and received_confirmed_at is null
      and received_confirmed_by is null
    )
  );

create or replace function public.confirm_beneficiary_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para confirmar la recepción.' using errcode = '42501';
  end if;

  select delivery.id, delivery.status as delivery_status,
         delivery.received_confirmed_at, request.id as request_id,
         request.status as request_status, donation.id as donation_id,
         donation.status as donation_status
    into delivery_row
    from public.deliveries as delivery
    join public.donation_requests as request on request.id = delivery.request_id
    join public.organizations as beneficiary on beneficiary.id = request.beneficiary_organization_id
    join public.donations as donation on donation.id = request.donation_id
   where delivery.id = p_delivery_id
     and beneficiary.owner_id = auth.uid()
     and beneficiary.organization_type = 'beneficiary'
   for update of delivery, request, donation;

  if not found then
    raise exception 'No encontramos una entrega de tu organización.' using errcode = 'P0002';
  end if;
  if delivery_row.request_status <> 'accepted' then
    raise exception 'La solicitud todavía no está aceptada.' using errcode = '22023';
  end if;
  if delivery_row.received_confirmed_at is not null then
    raise exception 'La recepción ya fue confirmada por la organización beneficiaria.' using errcode = '40001';
  end if;
  if delivery_row.delivery_status = 'cancelled' then
    raise exception 'La entrega fue cancelada y no se puede confirmar.' using errcode = '22023';
  end if;
  if delivery_row.donation_status not in ('reserved', 'pickup_in_progress', 'picked_up', 'delivered') then
    raise exception 'La donación ya no está en un estado que permita confirmar su recepción.' using errcode = '22023';
  end if;

  update public.deliveries
     set status = 'delivered', delivered_at = now(),
         received_confirmed_at = now(), received_confirmed_by = auth.uid()
   where id = p_delivery_id;
  update public.donations
     set status = 'delivered', updated_at = now()
   where id = delivery_row.donation_id;
  update public.donation_requests
     set updated_at = now()
   where id = delivery_row.request_id;
end;
$$;

revoke all on function public.confirm_beneficiary_delivery(uuid) from public, anon;
grant execute on function public.confirm_beneficiary_delivery(uuid) to authenticated;
