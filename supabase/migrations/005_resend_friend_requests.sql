-- INTERNET 2008: safe friend request send/re-send for existing projects.
-- Rejected requests can be re-opened; duplicate pending requests are blocked atomically.

create or replace function public.send_friend_request(p_receiver_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;
revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;
