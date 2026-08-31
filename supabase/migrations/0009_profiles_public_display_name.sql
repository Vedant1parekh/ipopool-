-- profiles.display_name is shown all over the app now (pools list, discover
-- pools, pool members, application co-members) but the original policy only
-- let a user read their own row, so every other member's name silently
-- resolved to null and fell back to "Unknown"/"Member" in the UI.
-- display_name isn't sensitive like PAN numbers, so open it up to any
-- signed-in user rather than scoping it to shared pools.
drop policy if exists "profiles are readable by their owner" on public.profiles;

create policy "any signed-in user can view display names"
  on public.profiles for select
  using (auth.role() = 'authenticated');
