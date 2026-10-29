-- INTERNET 2008: serialize random matchmaking and leave operations on existing projects.
-- This shared transaction lock prevents concurrent RPC calls from pairing one user twice.

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
  for update skip locked
  limit 1;
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
