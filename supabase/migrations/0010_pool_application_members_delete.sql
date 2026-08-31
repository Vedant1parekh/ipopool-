-- The insert policy lets a member club onto an application; nothing yet
-- lets them undo that. Leaving should always be allowed, even after the
-- allotment result is in (unlike joining, which is blocked at that point).
create policy "members can remove their own clubbing"
  on public.pool_application_members for delete
  using (auth.uid() = profile_id);
