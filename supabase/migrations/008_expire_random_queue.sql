-- INTERNET 2008: expire abandoned random-match queue entries.
-- The web client refreshes its queued_at lease while searching; users who close
-- the page without leaving are removed after 45 seconds.
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

