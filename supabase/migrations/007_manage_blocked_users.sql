-- INTERNET 2008: allow users to unblock accounts they blocked.
drop policy if exists "users unblock others" on public.blocks;
create policy "users unblock others" on public.blocks
  for delete to authenticated
  using (auth.uid() = blocker_id);
