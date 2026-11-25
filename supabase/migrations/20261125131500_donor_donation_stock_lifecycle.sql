-- Track one published batch independently from the requests and deliveries
-- that consume it. quantity remains the original published amount.
alter table public.donations
  add column if not exists available_quantity numeric(12, 2),
  add column if not exists reserved_quantity numeric(12, 2),
  add column if not exists delivered_quantity numeric(12, 2);

with fulfillment as (
  select request.donation_id,
         sum(case
           when delivery.received_confirmed_at is not null
             then coalesce(request.quantity_requested, donation.quantity)
           else 0
         end) as delivered,
         sum(case
           when request.status = 'accepted'
            and delivery.status is distinct from 'cancelled'
            and delivery.received_confirmed_at is null
             then coalesce(request.quantity_requested, donation.quantity)
           else 0
         end) as reserved
    from public.donation_requests as request
    join public.donations as donation on donation.id = request.donation_id
    left join public.deliveries as delivery on delivery.request_id = request.id
   where request.status = 'accepted'
   group by request.donation_id
), allocated as (
  select donation.id,
         least(donation.quantity, coalesce(fulfillment.delivered, 0)) as delivered,
         least(
           donation.quantity - least(donation.quantity, coalesce(fulfillment.delivered, 0)),
           coalesce(fulfillment.reserved, 0)
         ) as reserved
    from public.donations as donation
    left join fulfillment on fulfillment.donation_id = donation.id
)
update public.donations as donation
   set delivered_quantity = allocated.delivered,
       reserved_quantity = allocated.reserved,
       available_quantity = greatest(0, donation.quantity - allocated.delivered - allocated.reserved)
  from allocated
 where donation.id = allocated.id;

-- Old completed donations without a linked accepted request are treated as
-- fully delivered; other unused stock stays available when its offer is live.
update public.donations as donation
   set delivered_quantity = donation.quantity,
       reserved_quantity = 0,
       available_quantity = 0
 where donation.status in ('delivered', 'completed')
   and not exists (
     select 1 from public.donation_requests as request
      where request.donation_id = donation.id and request.status = 'accepted'
   );

alter table public.donations
  alter column available_quantity set default 0,
  alter column available_quantity set not null,
  alter column reserved_quantity set default 0,
  alter column reserved_quantity set not null,
  alter column delivered_quantity set default 0,
  alter column delivered_quantity set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'donations_stock_quantities_nonnegative') then
    alter table public.donations add constraint donations_stock_quantities_nonnegative
      check (available_quantity >= 0 and reserved_quantity >= 0 and delivered_quantity >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'donations_stock_quantities_match_total') then
    alter table public.donations add constraint donations_stock_quantities_match_total
      check (available_quantity + reserved_quantity + delivered_quantity = quantity);
  end if;
end;
$$;

update public.donations as donation
   set status = case
     when donation.status in ('cancelled', 'expired') then donation.status
     when donation.available_quantity > 0 then 'available'
     when donation.reserved_quantity > 0 then 'reserved'
     when donation.delivered_quantity > 0 then 'delivered'
     else donation.status
   end,
       updated_at = now()
 where donation.status <> case
     when donation.status in ('cancelled', 'expired') then donation.status
     when donation.available_quantity > 0 then 'available'
     when donation.reserved_quantity > 0 then 'reserved'
     when donation.delivered_quantity > 0 then 'delivered'
     else donation.status
   end;

create or replace function public.review_donation_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row record;
  requested_amount numeric(12, 2);
  remaining_amount numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para revisar la solicitud.' using errcode = '42501';
  end if;
  if p_decision is null or p_decision not in ('accepted', 'rejected') then
    raise exception 'La decisión de revisión no es válida.' using errcode = '22023';
  end if;

  select req.id, req.donation_id, req.status as request_status,
         req.quantity_requested, donation.available_quantity, donation.status as donation_status,
         donation.expires_at, donation.pickup_starts_at
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
    if request_row.donation_status <> 'available' or request_row.expires_at <= now()
       or request_row.available_quantity <= 0 then
      raise exception 'La donación ya no tiene existencias disponibles para aceptar solicitudes.' using errcode = '22023';
    end if;
    requested_amount := coalesce(request_row.quantity_requested, request_row.available_quantity);
    if requested_amount <= 0 or requested_amount > request_row.available_quantity then
      raise exception 'La cantidad solicitada supera las existencias disponibles.' using errcode = '22023';
    end if;
    remaining_amount := request_row.available_quantity - requested_amount;

    update public.donations
       set available_quantity = remaining_amount,
           reserved_quantity = reserved_quantity + requested_amount,
           status = case when remaining_amount = 0 then 'reserved' else 'available' end,
           updated_at = now()
     where id = request_row.donation_id;
    update public.donation_requests
       set quantity_requested = requested_amount, status = 'accepted', updated_at = now()
     where id = p_request_id;
    if remaining_amount = 0 then
      update public.donation_requests
         set status = 'rejected', updated_at = now()
       where donation_id = request_row.donation_id and id <> p_request_id and status = 'pending';
    end if;
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

create or replace function public.confirm_beneficiary_delivery(p_delivery_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;
  delivered_amount numeric(12, 2);
  remaining_reserved numeric(12, 2);
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para confirmar la recepción.' using errcode = '42501';
  end if;

  select delivery.id, delivery.status as delivery_status, delivery.received_confirmed_at,
         request.id as request_id, request.status as request_status,
         coalesce(request.quantity_requested, donation.quantity) as requested_amount,
         donation.id as donation_id, donation.status as donation_status,
         donation.available_quantity, donation.reserved_quantity
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
  if delivery_row.donation_status not in ('available', 'reserved', 'pickup_in_progress', 'picked_up', 'delivered') then
    raise exception 'La donación ya no está en un estado que permita confirmar su recepción.' using errcode = '22023';
  end if;
  delivered_amount := delivery_row.requested_amount;
  if delivered_amount <= 0 or delivery_row.reserved_quantity < delivered_amount then
    raise exception 'No se pudo validar la cantidad reservada para esta entrega.' using errcode = '22023';
  end if;
  remaining_reserved := delivery_row.reserved_quantity - delivered_amount;

  update public.deliveries
     set status = 'delivered', delivered_at = now(),
         received_confirmed_at = now(), received_confirmed_by = auth.uid()
   where id = p_delivery_id;
  update public.donations
     set reserved_quantity = remaining_reserved,
         delivered_quantity = delivered_quantity + delivered_amount,
         status = case
           when available_quantity > 0 then 'available'
           when remaining_reserved > 0 then 'reserved'
           else 'delivered'
         end,
         updated_at = now()
   where id = delivery_row.donation_id;
  update public.donation_requests set updated_at = now() where id = delivery_row.request_id;
end;
$$;

revoke all on function public.confirm_beneficiary_delivery(uuid) from public, anon;
grant execute on function public.confirm_beneficiary_delivery(uuid) to authenticated;

create or replace function public.release_donation_stock_after_delivery_cancel()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_row record;
  remaining_reserved numeric(12, 2);
  restored_available numeric(12, 2);
begin
  if new.status <> 'cancelled' or old.status = 'cancelled' or new.received_confirmed_at is not null then
    return new;
  end if;
  if old.status in ('pickup_in_progress', 'picked_up', 'delivered') then
    raise exception 'No se puede cancelar una entrega que ya comenzó.' using errcode = '22023';
  end if;

  select request.id, request.status, request.donation_id,
         coalesce(request.quantity_requested, donation.quantity) as requested_amount,
         donation.available_quantity, donation.reserved_quantity, donation.delivered_quantity,
         donation.expires_at, donation.status as donation_status
    into request_row
    from public.donation_requests as request
    join public.donations as donation on donation.id = request.donation_id
   where request.id = new.request_id;
  if not found or request_row.status <> 'accepted' then return new; end if;

  remaining_reserved := greatest(0, request_row.reserved_quantity - request_row.requested_amount);
  -- Return the reserved amount to the available bucket even when the offer
  -- has expired or was cancelled. Its status keeps it out of public searches,
  -- while the stock partition remains internally consistent.
  restored_available := request_row.available_quantity + request_row.requested_amount;

  update public.donation_requests set status = 'cancelled', updated_at = now() where id = request_row.id;
  update public.donations
     set reserved_quantity = remaining_reserved,
         available_quantity = restored_available,
         status = case
           when request_row.donation_status = 'cancelled' then 'cancelled'
           when request_row.expires_at <= now() then 'expired'
           when restored_available > 0 then 'available'
           when remaining_reserved > 0 then 'reserved'
           when request_row.delivered_quantity > 0 then 'delivered'
           else 'available'
         end,
         updated_at = now()
   where id = request_row.donation_id;
  return new;
end;
$$;

drop trigger if exists deliveries_release_stock_after_cancel on public.deliveries;
create trigger deliveries_release_stock_after_cancel
  after update of status on public.deliveries
  for each row execute function public.release_donation_stock_after_delivery_cancel();
revoke all on function public.release_donation_stock_after_delivery_cancel() from public, anon, authenticated;

create or replace function public.cancel_beneficiary_donation_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  delivery_row record;
  pending_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para cancelar la solicitud.' using errcode = '42501';
  end if;

  select true into pending_exists
    from public.donation_requests as request
    join public.organizations as beneficiary on beneficiary.id = request.beneficiary_organization_id
   where request.id = p_request_id and request.status = 'pending'
     and beneficiary.owner_id = auth.uid() and beneficiary.organization_type = 'beneficiary'
     and beneficiary.status = 'active' and beneficiary.verification_status = 'approved';
  if coalesce(pending_exists, false) then
    update public.donation_requests set status = 'cancelled', updated_at = now()
     where id = p_request_id and status = 'pending';
    if found then return; end if;
  end if;

  -- Lock in the same delivery -> request -> donation order as receipt confirmation.
  select delivery.id, delivery.status, delivery.received_confirmed_at,
         request.id as request_id, request.status as request_status
    into delivery_row
    from public.deliveries as delivery
    join public.donation_requests as request on request.id = delivery.request_id
    join public.organizations as beneficiary on beneficiary.id = request.beneficiary_organization_id
    join public.donations as donation on donation.id = request.donation_id
   where request.id = p_request_id and beneficiary.owner_id = auth.uid()
     and beneficiary.organization_type = 'beneficiary'
     and beneficiary.status = 'active' and beneficiary.verification_status = 'approved'
   for update of delivery, request, donation;
  if not found then
    raise exception 'No encontramos una solicitud pendiente o aceptada de tu organización.' using errcode = 'P0002';
  end if;
  if delivery_row.request_status <> 'accepted' then
    raise exception 'Solo se pueden cancelar solicitudes pendientes o aceptadas.' using errcode = '22023';
  end if;
  if delivery_row.received_confirmed_at is not null or delivery_row.status in ('pickup_in_progress', 'picked_up', 'delivered') then
    raise exception 'La entrega ya comenzó; contacta a la organización para coordinar un cambio.' using errcode = '22023';
  end if;
  if delivery_row.status = 'cancelled' then
    raise exception 'La entrega ya fue cancelada.' using errcode = '40001';
  end if;
  update public.deliveries set status = 'cancelled' where id = delivery_row.id;
end;
$$;

revoke all on function public.cancel_beneficiary_donation_request(uuid) from public, anon;
grant execute on function public.cancel_beneficiary_donation_request(uuid) to authenticated;

create or replace function public.restock_donor_donation(
  p_source_donation_id uuid,
  p_quantity numeric,
  p_pickup_starts_at timestamptz,
  p_pickup_ends_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  donor_row record;
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para reponer existencias.' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad de reposición debe ser mayor que cero.' using errcode = '22023';
  end if;
  if p_pickup_starts_at is null or p_pickup_ends_at is null
     or p_pickup_starts_at <= now() or p_pickup_ends_at <= p_pickup_starts_at then
    raise exception 'Indica un horario futuro válido para recoger el alimento.' using errcode = '22023';
  end if;

  select donation.*
    into donor_row
    from public.donations as donation
    join public.organizations as organization on organization.id = donation.donor_organization_id
   where donation.id = p_source_donation_id
     and organization.owner_id = auth.uid()
     and organization.organization_type = 'donor'
     and organization.status = 'active'
     and organization.verification_status = 'approved'
     and donation.available_quantity = 0
     and donation.reserved_quantity = 0
   for update of donation;
  if not found then
    raise exception 'Solo puedes reponer una publicación de tu organización que ya no tenga stock disponible.' using errcode = '22023';
  end if;

  insert into public.donations (
    donor_organization_id, food_name, category_id, quantity, available_quantity,
    reserved_quantity, delivered_quantity, unit, expires_at, pickup_starts_at,
    pickup_ends_at, address, city, latitude, longitude, notes, status, is_visible, image_path
  ) values (
    donor_row.donor_organization_id, donor_row.food_name, donor_row.category_id,
    p_quantity, p_quantity, 0, 0, donor_row.unit, p_pickup_ends_at,
    p_pickup_starts_at, p_pickup_ends_at, donor_row.address, donor_row.city,
    donor_row.latitude, donor_row.longitude, donor_row.notes, 'available', true, donor_row.image_path
  ) returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.restock_donor_donation(uuid, numeric, timestamptz, timestamptz) from public, anon;
grant execute on function public.restock_donor_donation(uuid, numeric, timestamptz, timestamptz) to authenticated;
