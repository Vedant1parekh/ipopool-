-- Pools are now scoped to exactly one IPO and one application category,
-- instead of being a standing group that logs applications across many
-- IPOs/categories independently. Wipes existing test pools (agreed with
-- the user — no real users/data yet) rather than migrating them.

truncate table public.pools cascade; -- also clears pool_members, pool_applications

alter table public.pools
  add column ipo_id uuid not null references public.ipos (id),
  add column category text not null check (category in ('retail', 'shni', 'bhni'));

alter table public.pool_applications
  drop column ipo_id,
  drop column category;
