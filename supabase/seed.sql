-- Sample IPO data for local testing of the dashboard, before a real
-- data provider (IPO Guru / ipoalerts.in) is wired up. Safe to re-run.
-- Paste into Supabase SQL Editor and run.

insert into public.ipos
  (name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status, source)
values
  ('Nova Renewables Ltd',        'mainboard', '2026-08-25', '2026-08-27', '2026-09-01', 210, 222, 65,   'closed',   'seed'),
  ('BrightPath Logistics Ltd',   'mainboard', '2026-08-27', '2026-08-29', '2026-09-03', 145, 152, 95,   'open',     'seed'),
  ('Solstice Pharma Ltd',        'mainboard', '2026-09-03', '2026-09-05', '2026-09-10', 480, 505, 30,   'upcoming', 'seed'),
  ('Kavach Defence Systems Ltd', 'mainboard', '2026-08-10', '2026-08-12', '2026-08-18', 690, 715, 20,   'listed',   'seed'),
  ('Trident Steel Works Ltd',    'mainboard', '2026-09-08', '2026-09-10', '2026-09-16', 92,  98,  150,  'upcoming', 'seed'),
  ('QuickCart Retail Ltd',       'sme',       '2026-08-26', '2026-08-28', '2026-09-02', 68,  72,  2000, 'open',     'seed'),
  ('Vantage Precision Tools Ltd','sme',       '2026-08-08', '2026-08-12', '2026-08-19', 120, 126, 1000, 'listed',   'seed'),
  ('Greenline Agro Foods Ltd',   'sme',       '2026-09-05', '2026-09-09', '2026-09-15', 45,  48,  3000, 'upcoming', 'seed'),
  ('Orbit Data Systems Ltd',     'sme',       '2026-08-20', '2026-08-22', '2026-08-28', 155, 162, 800,  'closed',   'seed'),
  ('Pinnacle Textiles Ltd',      'sme',       '2026-09-12', '2026-09-16', '2026-09-22', 33,  35,  4000, 'upcoming', 'seed')
on conflict (name, type) do nothing;
