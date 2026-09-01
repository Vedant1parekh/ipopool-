-- Tracks the last date the ipoalerts.in sync actually ran, so it can be
-- triggered opportunistically (first login of the day) instead of relying
-- solely on Vercel Cron. Singleton row (id always 1); the sync claims it
-- atomically via `update ... where last_synced_date < current_date`, so
-- concurrent logins on the same day only trigger one real sync.
create table public.ipo_sync_state (
  id int primary key default 1 check (id = 1),
  last_synced_date date not null default '1970-01-01'
);

insert into public.ipo_sync_state (id) values (1) on conflict do nothing;

alter table public.ipo_sync_state enable row level security;
-- No policies: only ever touched via the service-role client (same as
-- writes to `ipos`), never directly by a signed-in user's session.
