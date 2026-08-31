-- 0012 was originally written with last_modified_by as uuid (references
-- profiles), then changed to text before some environments applied it —
-- so this DB may have either the old uuid version or the current text
-- version already. Fix it up only if it's still uuid; no-op otherwise.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'pool_applications'
      and column_name = 'last_modified_by' and data_type = 'uuid'
  ) then
    alter table public.pool_applications drop constraint if exists pool_applications_last_modified_by_fkey;
    alter table public.pool_applications alter column last_modified_by type text using last_modified_by::text;
  end if;
end $$;
