-- DESTRUCTIVE — deletes ALL rows (real and test) from these tables:
--   ipos, pools, pool_members, pool_applications, pool_application_members
-- Dashboard, Pools, Allotments, and Profit/Loss will all show empty after
-- this. pan_cards and profiles are NOT touched — PAN cards and accounts
-- stay intact. ipos repopulates on the next login (or cron run).
-- Run in the Supabase SQL Editor. Cannot be undone.

truncate table
  public.pool_application_members,
  public.pool_applications,
  public.pool_members,
  public.pools,
  public.ipos
cascade;
