-- Treat an administrator-approved organization as verified for sign-in.
-- Keep the approval decision in the database; never expose service_role to the client.

create or replace function public.confirm_organization_owner_email_after_approval()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.verification_status = 'approved'
     and old.verification_status is distinct from new.verification_status then
    update auth.users as auth_user
    set email_confirmed_at = coalesce(auth_user.email_confirmed_at, pg_catalog.now())
    where auth_user.id = new.owner_id
      and auth_user.email_confirmed_at is null;
  end if;

  return new;
end;
$$;

revoke all on function public.confirm_organization_owner_email_after_approval() from public, anon, authenticated;

drop trigger if exists confirm_organization_owner_email_after_approval on public.organizations;
create trigger confirm_organization_owner_email_after_approval
after update of verification_status on public.organizations
for each row
when (old.verification_status is distinct from new.verification_status and new.verification_status = 'approved')
execute function public.confirm_organization_owner_email_after_approval();

-- Repair organizations approved before this migration, including the account
-- currently unable to sign in.
update auth.users as users
set email_confirmed_at = coalesce(users.email_confirmed_at, pg_catalog.now())
from public.organizations as organizations
where organizations.owner_id = users.id
  and organizations.verification_status = 'approved'
  and users.email_confirmed_at is null;
