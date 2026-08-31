-- Profit/loss for a clubbed, alloted application is a shared fact (like
-- allotment_status), not a private ledger entry — so it lives directly on
-- pool_applications rather than the separate per-user profit_records table.
-- Tax is fixed at 20.8% (20% STCG + 4% cess) and skipped on a loss.
-- Generated columns can't reference each other, so each repeats the diff.

alter table public.pool_applications
  add column if not exists amount_deducted numeric,
  add column if not exists amount_received numeric,
  add column if not exists gross_profit numeric generated always as (
    amount_received - amount_deducted
  ) stored,
  add column if not exists tax numeric generated always as (
    greatest(amount_received - amount_deducted, 0) * 0.208
  ) stored,
  add column if not exists net_profit numeric generated always as (
    (amount_received - amount_deducted) - greatest(amount_received - amount_deducted, 0) * 0.208
  ) stored,
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'done')),
  add column if not exists remarks text;

-- Existing "pool members can update applications in their pools" policy
-- (migration 0005) already covers writes to these new columns — no new
-- policy needed, same as allotment_status.
