-- Removes all dummy/test data created by seed_dummy_allotment.sql.
-- Run in the Supabase SQL Editor.
--
-- Deleting the 3 dummy auth.users rows cascades automatically to: their
-- profiles, pan_cards, the 2 pools they own (Dummy Test IPO_retail_seed /
-- _shni_seed), pool_members rows (including your own membership added to
-- those pools), and pool_applications they created — covering dashboard
-- (via the dummy IPO below), pools, allotments, and profit/loss all at
-- once, since all of that dummy data traces back to these users + IPO.

delete from auth.users where email like '%@dummy.ipopool.test';

-- Standalone — not owned by a profile, so it doesn't cascade from the above.
delete from public.ipos where name = 'Dummy Test IPO';

-- Safety net in case pool ownership ever changes — should already be gone
-- via the cascade above.
delete from public.pools where invite_code in ('dummy001', 'dummy002');
