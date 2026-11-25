alter table public.chat_messages
  add column reply_to_message_id uuid references public.chat_messages(id) on delete set null,
  add column deleted_at timestamptz;

create index chat_messages_reply_to_message_idx
  on public.chat_messages (reply_to_message_id)
  where reply_to_message_id is not null;

revoke update on public.chat_messages from public, anon, authenticated;
revoke delete on public.chat_messages from public, anon, authenticated;
grant update (deleted_at) on public.chat_messages to authenticated;

create policy chat_messages_delete_own
  on public.chat_messages for update to authenticated
  using (
    sender_id = (select auth.uid())
    and deleted_at is null
  )
  with check (
    sender_id = (select auth.uid())
    and deleted_at is not null
  );

create or replace function private.validate_chat_reply_target()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_conversation_id uuid;
  target_deleted_at timestamptz;
begin
  new.deleted_at := null;

  if new.reply_to_message_id is not null then
    select message.conversation_id, message.deleted_at
      into target_conversation_id, target_deleted_at
      from public.chat_messages as message
      where message.id = new.reply_to_message_id;

    if not found
      or target_conversation_id <> new.conversation_id
      or target_deleted_at is not null then
      raise exception 'No se puede responder a ese mensaje.';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.validate_chat_reply_target() from public, anon, authenticated;

create trigger chat_messages_validate_reply
  before insert on public.chat_messages
  for each row execute function private.validate_chat_reply_target();

create or replace function private.soft_delete_own_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is not null or old.sender_id <> auth.uid() then
    raise exception 'Solo puedes eliminar tus propios mensajes una vez.';
  end if;

  if new.deleted_at is null then
    raise exception 'La eliminación del mensaje no es válida.';
  end if;

  new.content := 'Este mensaje fue eliminado.';
  new.deleted_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.soft_delete_own_chat_message() from public, anon, authenticated;

create trigger chat_messages_soft_delete
  before update of deleted_at on public.chat_messages
  for each row execute function private.soft_delete_own_chat_message();

create trigger chat_messages_refresh_conversation_after_delete
  after update of deleted_at on public.chat_messages
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function private.bump_chat_conversation_updated_at();
