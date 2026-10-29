-- INTERNET 2008: close the direct-update path for friend requests.
-- The previous receiver-update policy allowed changing sender_id/receiver_id while accepting,
-- which could be abused to forge an accepted friendship. Responses must use the validated RPC.
drop policy if exists "receiver can respond" on public.friend_requests;
