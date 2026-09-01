-- Nothing enforced a minimum gap between batches — two logins within the
-- same minute would both try to fire 6 requests, immediately re-hitting
-- ipoalerts.in's 6 req/min limit before it even resets. Track when the
-- last batch actually ran so a new invocation can skip (leaving it for a
-- later trigger) if under a minute has passed.
alter table public.ipo_sync_state
  add column if not exists last_batch_at timestamptz;
