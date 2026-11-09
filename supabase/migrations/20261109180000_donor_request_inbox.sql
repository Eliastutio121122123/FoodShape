alter table public.donation_requests
  add column if not exists quantity_requested numeric(12, 2),
  add column if not exists message text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_requests_quantity_requested_positive'
      and conrelid = 'public.donation_requests'::regclass
  ) then
    alter table public.donation_requests
      add constraint donation_requests_quantity_requested_positive
      check (quantity_requested is null or quantity_requested > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'donation_requests_message_max_length'
      and conrelid = 'public.donation_requests'::regclass
  ) then
    alter table public.donation_requests
      add constraint donation_requests_message_max_length
      check (message is null or length(message) <= 500);
  end if;
end;
$$;

create or replace function public.review_donation_request(p_request_id uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = public
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
         donation.status as donation_status, donation.expires_at
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
  else
    update public.donation_requests
       set status = 'rejected', updated_at = now()
     where id = p_request_id;
  end if;
end;
$$;

revoke all on function public.review_donation_request(uuid, text) from public;
grant execute on function public.review_donation_request(uuid, text) to authenticated;
