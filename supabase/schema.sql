-- INTERNET 2008 database schema
-- Run in Supabase SQL Editor on a new project.
-- Review this schema and test with separate accounts before public launch.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Internet Friend' check (char_length(display_name) between 1 and 24),
  mood text not null default 'Listening to old internet' check (char_length(mood) <= 80),
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id text primary key,
  name text not null,
  description text not null default '',
  is_active boolean not null default true
);

insert into public.rooms (id,name,description) values
 ('cafe','Old Internet Café','General chat & nostalgia'),
 ('gaming','Gaming Zone','Games, memes & internet culture'),
 ('late-night','Late Night Talks','Slow conversations after dark'),
 ('friendship','Friendship Corner','Meet people, be kind')
on conflict (id) do nothing;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id text not null references public.rooms(id),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists messages_room_created_idx on public.messages(room_id, created_at desc);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('friend','random')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists private_messages_conversation_idx on public.private_messages(conversation_id, created_at);

create table if not exists public.random_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  queued_at timestamptz not null default now()
);
create table if not exists public.random_matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  check (user_a <> user_b)
);
create unique index if not exists one_active_match_per_user_a on public.random_matches(user_a) where status='active';
create unique index if not exists one_active_match_per_user_b on public.random_matches(user_b) where status='active';

create table if not exists public.random_match_messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.random_matches(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists random_match_messages_idx on public.random_match_messages(match_id, created_at);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  context text not null default '',
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

-- Profiles: authenticated users can read profiles for display; only own profile can be changed.
alter table public.profiles enable row level security;
create policy "profiles readable to authenticated users" on public.profiles for select to authenticated using (true);
create policy "users create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

alter table public.rooms enable row level security;
create policy "active rooms readable" on public.rooms for select to authenticated using (is_active = true);

alter table public.messages enable row level security;
create policy "authenticated users read room messages" on public.messages for select to authenticated using (
  exists (select 1 from public.rooms r where r.id = room_id and r.is_active)
);
create policy "users send room messages as self" on public.messages for insert to authenticated with check (
  auth.uid() = sender_id and exists (select 1 from public.rooms r where r.id = room_id and r.is_active)
);

alter table public.friend_requests enable row level security;
create policy "sender or receiver can read requests" on public.friend_requests for select to authenticated using (auth.uid() in (sender_id, receiver_id));
create policy "users send requests as self" on public.friend_requests for insert to authenticated with check (auth.uid() = sender_id);
-- Friend requests are accepted/rejected only through respond_friend_request(),
-- which locks and validates the row before updating it transactionally.

alter table public.friendships enable row level security;
create policy "friends can read own friendship" on public.friendships for select to authenticated using (auth.uid() in (user_a,user_b));
create policy "users create friendship from accepted request" on public.friendships for insert to authenticated with check (
  auth.uid() in (user_a,user_b) and exists (
    select 1 from public.friend_requests fr
    where fr.status='accepted'
      and ((fr.sender_id=user_a and fr.receiver_id=user_b) or (fr.sender_id=user_b and fr.receiver_id=user_a))
  )
);

-- Respond and create the friendship in one transaction so a failed insert cannot
-- leave a request accepted while the users are not friends.
create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  me uuid := auth.uid();
  req public.friend_requests%rowtype;
  a uuid;
  b uuid;
begin
  if me is null then raise exception 'Sign in required'; end if;
  select * into req from public.friend_requests
    where id = p_request_id for update;
  if not found or req.receiver_id <> me then
    raise exception 'Friend request not found';
  end if;
  if req.status <> 'pending' then
    raise exception 'Friend request is no longer pending';
  end if;

  update public.friend_requests
    set status = case when p_accept then 'accepted' else 'rejected' end
    where id = req.id;

  if p_accept then
    a := least(req.sender_id, req.receiver_id);
    b := greatest(req.sender_id, req.receiver_id);
    insert into public.friendships(user_a, user_b)
      values (a, b) on conflict (user_a, user_b) do nothing;
  end if;
end;
$;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

-- Send or safely re-send a friend request without duplicate pending requests.
create or replace function public.send_friend_request(p_receiver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  existing_status text;
begin
  if me is null then raise exception 'Sign in required'; end if;
  if p_receiver_id is null or p_receiver_id = me then
    raise exception 'Choose another user';
  end if;
  if not exists (select 1 from public.profiles where id = p_receiver_id) then
    raise exception 'Profile not found';
  end if;

  a := least(me, p_receiver_id);
  b := greatest(me, p_receiver_id);
  -- Serialize both request directions for this pair.
  perform pg_advisory_xact_lock(hashtextextended(a::text || ':' || b::text, 0));

  if exists (select 1 from public.friendships f where f.user_a = a and f.user_b = b) then
    raise exception 'You are already friends';
  end if;
  if exists (
    select 1 from public.friend_requests fr
    where fr.status = 'pending'
      and ((fr.sender_id = me and fr.receiver_id = p_receiver_id)
        or (fr.sender_id = p_receiver_id and fr.receiver_id = me))
  ) then
    raise exception 'A friend request is already pending between you';
  end if;

  select status into existing_status
    from public.friend_requests
    where sender_id = me and receiver_id = p_receiver_id
    for update;
  if found then
    if existing_status = 'rejected' then
      update public.friend_requests
        set status = 'pending', created_at = now()
        where sender_id = me and receiver_id = p_receiver_id;
      return;
    end if;
    raise exception 'This friend request has already been processed';
  end if;

  insert into public.friend_requests(sender_id, receiver_id, status)
    values (me, p_receiver_id, 'pending');
end;
$;
revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;


alter table public.conversations enable row level security;
create policy "members read conversation" on public.conversations for select to authenticated using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid())
);
alter table public.conversation_members enable row level security;
-- Avoid recursive RLS evaluation: each user can see only their own membership rows.
create policy "users see own membership" on public.conversation_members
  for select to authenticated using (user_id = auth.uid());
-- Membership insertion is intentionally not granted to clients; trusted server functions should create memberships.

alter table public.private_messages enable row level security;
create policy "conversation members read private messages" on public.private_messages for select to authenticated using (
  exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = private_messages.conversation_id
      and cm.user_id = auth.uid()
  )
);
create policy "members send private messages" on public.private_messages for insert to authenticated with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = private_messages.conversation_id
      and cm.user_id = auth.uid()
  )
);

alter table public.random_queue enable row level security;
create policy "users see own queue entry" on public.random_queue for select to authenticated using (auth.uid()=user_id);
-- Queue writes are intentionally server-only. Use RPC functions below.

alter table public.random_matches enable row level security;
create policy "match participants can read matches" on public.random_matches for select to authenticated using (auth.uid() in (user_a,user_b));
-- Client writes are intentionally not granted.

alter table public.random_match_messages enable row level security;
create policy "participants read match messages" on public.random_match_messages for select to authenticated using (
  exists (select 1 from public.random_matches rm where rm.id=match_id and rm.status='active' and auth.uid() in (rm.user_a,rm.user_b))
);
create policy "participants send match messages" on public.random_match_messages for insert to authenticated with check (
  auth.uid()=sender_id and exists (select 1 from public.random_matches rm where rm.id=match_id and rm.status='active' and auth.uid() in (rm.user_a,rm.user_b))
);

alter table public.blocks enable row level security;
create policy "users read blocks they created" on public.blocks for select to authenticated using (auth.uid()=blocker_id);
create policy "users block others" on public.blocks for insert to authenticated with check (auth.uid()=blocker_id);
create policy "users unblock others" on public.blocks for delete to authenticated using (auth.uid()=blocker_id);

alter table public.reports enable row level security;
create policy "users create reports as self" on public.reports for insert to authenticated with check (auth.uid()=reporter_id);
create policy "users see own reports" on public.reports for select to authenticated using (auth.uid()=reporter_id);

-- Matchmaking RPC: server-side transaction, so two users cannot claim the same queue entry.
create or replace function public.find_random_match()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  partner uuid;
  new_match uuid;
  partner_name text;
begin
  if me is null then raise exception 'Sign in required'; end if;
  -- Serialize matchmaking and leaving so a user cannot be claimed by overlapping requests.
  perform pg_advisory_xact_lock(20081008::bigint);
  -- Remove abandoned queue entries; active clients refresh their queue lease periodically.
  delete from public.random_queue where queued_at < now() - interval '45 seconds';
  if exists (select 1 from random_matches where status='active' and me in (user_a,user_b)) then
    raise exception 'You already have an active match';
  end if;
  insert into random_queue(user_id) values (me) on conflict (user_id) do update set queued_at=now();
  select q.user_id into partner
  from random_queue q
  where q.user_id <> me
    and not exists (select 1 from blocks b where (b.blocker_id=me and b.blocked_id=q.user_id) or (b.blocker_id=q.user_id and b.blocked_id=me))
    and not exists (select 1 from random_matches rm where rm.status='active' and q.user_id in (rm.user_a,rm.user_b))
  order by q.queued_at
  limit 1
  for update skip locked;
  if partner is null then
    return jsonb_build_object('status','queued');
  end if;
  delete from random_queue where user_id in (me,partner);
  insert into random_matches(user_a,user_b) values (least(me,partner),greatest(me,partner)) returning id into new_match;
  select display_name into partner_name from profiles where id=partner;
  return jsonb_build_object('status','matched','match_id',new_match,'partner_id',partner,'partner_name',partner_name);
end;
$$;
revoke all on function public.find_random_match() from public;
grant execute on function public.find_random_match() to authenticated;

create or replace function public.leave_random_match()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'Sign in required'; end if;
  -- Use the same lock as find_random_match to avoid leave/start races.
  perform pg_advisory_xact_lock(20081008::bigint);
  delete from random_queue where user_id=me;
  update random_matches set status='ended',ended_at=now()
    where status='active' and me in (user_a,user_b);
end;
$$;
revoke all on function public.leave_random_match() from public;
grant execute on function public.leave_random_match() to authenticated;

-- Add tables to Realtime publication (safe to run more than once).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
when undefined_object then raise notice 'Create supabase_realtime publication in Supabase before enabling realtime tables.';
end $$;
do $$
begin
  alter publication supabase_realtime add table public.random_match_messages;
exception when duplicate_object then null;
when undefined_object then raise notice 'Realtime publication unavailable.';
end $$;

-- Important production hardening:
-- * Configure email confirmation and CAPTCHA/rate limits in Supabase Auth.
-- * Do not expose service_role key to browser.
-- * Add abuse-review admin workflow and a retention/deletion policy.
-- * Audit RLS, matchmaking concurrency and presence before public launch.
