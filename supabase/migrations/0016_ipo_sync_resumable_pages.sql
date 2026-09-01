-- ipoalerts.in allows 6 requests/min — firing more than that in one
-- invocation gets a 429 (confirmed: pages 1-6 succeeded, page 7 failed).
-- Sleeping between requests to pace them would make the function run for
-- minutes, risking a serverless timeout, so instead each invocation
-- fetches only one batch (6 pages) and resumes from where it left off on
-- the next login or cron run, tracked here.
alter table public.ipo_sync_state
  add column if not exists next_page int not null default 1,
  add column if not exists total_pages int;
