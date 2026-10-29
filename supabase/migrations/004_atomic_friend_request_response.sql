-- INTERNET 2008: make friend-request responses atomic on existing projects.

-- Remove direct client updates: the old policy let receivers alter sender_id/receiver_id
-- while changing status, which could be abused to forge an accepted friendship.
drop policy if exists "receiver can respond" on public.friend_requests;

-- This prevents a request from being marked accepted if friendship creation fails.

create or replace function public.respond_friend_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;
revoke all on function public.respond_friend_request(uuid, boolean) from public;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
