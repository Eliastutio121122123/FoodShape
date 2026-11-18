create index chat_conversations_created_by_idx
  on public.chat_conversations (created_by);

create index chat_messages_sender_id_idx
  on public.chat_messages (sender_id);
