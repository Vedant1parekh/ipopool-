-- Pools are discoverable/joinable by anyone now (migration 0007), so
-- there's no reason for two separate pools to exist for the same IPO +
-- category — that just fragments people who should be pooling together.
alter table public.pools
  add constraint pools_ipo_category_unique unique (ipo_id, category);
