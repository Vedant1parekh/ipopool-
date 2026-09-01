-- The ipoalerts.in response carries far more than we were storing (symbol,
-- logo, about/strengths/risks, the full schedule, issue size, prospectus
-- link, etc.) — needed now that IPOs get their own details page.
alter table public.ipos
  add column if not exists symbol text,
  add column if not exists slug text,
  add column if not exists logo_url text,
  add column if not exists about text,
  add column if not exists strengths text[],
  add column if not exists risks text[],
  add column if not exists schedule jsonb,
  add column if not exists issue_size text,
  add column if not exists min_amount numeric,
  add column if not exists prospectus_url text,
  add column if not exists nse_info_url text,
  add column if not exists bse_info_url text,
  add column if not exists type_of_issue text;
