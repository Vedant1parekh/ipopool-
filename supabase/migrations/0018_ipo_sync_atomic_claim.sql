-- The previous select-then-update approach isn't safe under real
-- concurrency: if N logins land at the same instant, all N read the same
-- stale state before any of them writes back, so all N can decide to fetch
-- a batch simultaneously — firing up to 6*N requests at once regardless of
-- the cooldown check. `for update` here locks the single row so concurrent
-- callers serialize through this function one at a time; only the first
-- actually gets should_run = true, and every other caller sees the
-- just-updated last_batch_at and backs off correctly.
create or replace function public.claim_ipo_sync_batch(cooldown_seconds int)
returns table (should_run boolean, start_page int, known_total_pages int)
language plpgsql
security definer set search_path = public
as $$
declare
  row_last_synced_date date;
  row_next_page int;
  row_total_pages int;
  row_last_batch_at timestamptz;
  today date := current_date;
begin
  select last_synced_date, next_page, total_pages, last_batch_at
    into row_last_synced_date, row_next_page, row_total_pages, row_last_batch_at
    from public.ipo_sync_state
    where id = 1
    for update;

  if row_last_synced_date < today then
    row_next_page := 1;
    row_total_pages := null;
    row_last_batch_at := null;
  end if;

  if row_total_pages is not null and row_next_page > row_total_pages then
    return query select false, row_next_page, row_total_pages;
    return;
  end if;

  if row_last_batch_at is not null and row_last_batch_at > now() - make_interval(secs => cooldown_seconds) then
    return query select false, row_next_page, row_total_pages;
    return;
  end if;

  update public.ipo_sync_state
    set last_synced_date = today, last_batch_at = now(), next_page = row_next_page, total_pages = row_total_pages
    where id = 1;

  return query select true, row_next_page, row_total_pages;
end;
$$;

grant execute on function public.claim_ipo_sync_batch(int) to service_role;
