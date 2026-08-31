-- Tracks who last saved a change on an application — used by both the
-- Allotment checklist (setAllotmentStatus) and the Profit/Loss Save button
-- (setApplicationFinancials), since both write to pool_applications.
-- Stores the display name directly (not a profile id) so it's readable
-- without a join.
alter table public.pool_applications
  add column if not exists last_modified_by text;

-- Existing "pool members can update applications in their pools" policy
-- already covers writes to this column — no new policy needed.
