create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  person_display_name text not null default '',
  organization_name text not null default '',
  organization_type text not null default 'beneficiary'
    check (organization_type in ('donor', 'beneficiary')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_person_organization_unique unique (person_id, organization_id)
);

create index chat_conversations_person_updated_idx
  on public.chat_conversations (person_id, updated_at desc);
create index chat_conversations_organization_updated_idx
  on public.chat_conversations (organization_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(btrim(content)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

grant select, insert on public.chat_conversations to authenticated;
grant select, insert on public.chat_messages to authenticated;

create or replace function private.prepare_chat_conversation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.created_by := auth.uid();

  select profile.full_name
    into new.person_display_name
    from public.profiles as profile
    where profile.id = new.person_id;

  select organization.name, organization.organization_type
    into new.organization_name, new.organization_type
    from public.organizations as organization
    where organization.id = new.organization_id;

  if new.person_display_name is null or new.organization_name is null or new.organization_type is null then
    raise exception 'No se pudieron comprobar los participantes del chat.';
  end if;

  return new;
end;
$$;

revoke all on function private.prepare_chat_conversation() from public, anon, authenticated;

create trigger chat_conversations_prepare_names
  before insert on public.chat_conversations
  for each row execute function private.prepare_chat_conversation();

create or replace function private.bump_chat_conversation_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.chat_conversations
    set updated_at = new.created_at
    where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function private.bump_chat_conversation_updated_at() from public, anon, authenticated;

create trigger chat_messages_bump_conversation
  after insert on public.chat_messages
  for each row execute function private.bump_chat_conversation_updated_at();

create policy chat_conversations_read_participant
  on public.chat_conversations for select to authenticated
  using (
    person_id = (select auth.uid())
    or exists (
      select 1 from public.organizations as organization
      where organization.id = chat_conversations.organization_id
        and organization.owner_id = (select auth.uid())
    )
  );

create policy chat_conversations_create_participant
  on public.chat_conversations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      (
        person_id = (select auth.uid())
        and exists (
          select 1 from public.profiles as profile
          where profile.id = (select auth.uid())
            and profile.role = 'person'
            and profile.status = 'active'
        )
        and exists (
          select 1 from public.organizations as organization
          where organization.id = chat_conversations.organization_id
            and organization.verification_status = 'approved'
            and organization.status = 'active'
        )
      )
      or exists (
        select 1 from public.organizations as organization
        where organization.id = chat_conversations.organization_id
          and organization.owner_id = (select auth.uid())
          and exists (
            select 1 from public.individual_aid_requests as request
            where request.person_id = chat_conversations.person_id
              and request.organization_id = chat_conversations.organization_id
          )
      )
    )
  );

create policy chat_messages_read_participant
  on public.chat_messages for select to authenticated
  using (
    exists (
      select 1 from public.chat_conversations as conversation
      where conversation.id = chat_messages.conversation_id
        and (
          conversation.person_id = (select auth.uid())
          or exists (
            select 1 from public.organizations as organization
            where organization.id = conversation.organization_id
              and organization.owner_id = (select auth.uid())
          )
        )
    )
  );

create policy chat_messages_send_as_participant
  on public.chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.chat_conversations as conversation
      where conversation.id = chat_messages.conversation_id
        and (
          conversation.person_id = (select auth.uid())
          or exists (
            select 1 from public.organizations as organization
            where organization.id = conversation.organization_id
              and organization.owner_id = (select auth.uid())
          )
        )
    )
  );

alter publication supabase_realtime add table public.chat_messages;
