-- INTERNET 2008: friend private messaging migration
-- Run this once in the Supabase SQL Editor on an existing installation.

create table if not exists public.friend_conversation_pairs (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
alter table public.friend_conversation_pairs enable row level security;

-- Avoid recursive RLS evaluation on conversation_members while keeping membership private.
drop policy if exists "members see their conversations" on public.conversation_members;
drop policy if exists "users see own membership" on public.conversation_members;
create policy "users see own membership" on public.conversation_members
  for select to authenticated using (user_id = auth.uid());

create or replace function public.get_or_create_friend_conversation(p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  conversation uuid;
begin
  if me is null then raise exception 'Sign in required'; end if;
  if p_friend_id is null or p_friend_id = me then raise exception 'Choose another user'; end if;

  a := least(me, p_friend_id);
  b := greatest(me, p_friend_id);
  if not exists (select 1 from friendships f where f.user_a = a and f.user_b = b) then
    raise exception 'Private messages are only available between accepted friends';
  end if;

  select p.conversation_id into conversation
    from friend_conversation_pairs p where p.user_a = a and p.user_b = b;
  if conversation is null then
    insert into conversations(kind) values ('friend') returning id into conversation;
    insert into friend_conversation_pairs(user_a, user_b, conversation_id)
      values (a, b, conversation) on conflict (user_a, user_b) do nothing;
    select p.conversation_id into conversation
      from friend_conversation_pairs p where p.user_a = a and p.user_b = b;
  end if;

  insert into conversation_members(conversation_id, user_id)
    values (conversation, a), (conversation, b)
    on conflict (conversation_id, user_id) do nothing;
  return conversation;
end;
$$;
revoke all on function public.get_or_create_friend_conversation(uuid) from public;
grant execute on function public.get_or_create_friend_conversation(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.private_messages;
exception when duplicate_object then null;
when undefined_object then raise notice 'Realtime publication unavailable.';
end $$;
