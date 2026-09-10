-- Allotment status + profit/loss financials live directly on
-- pool_applications (0005, 0011), which cascades away the instant its pool
-- is deleted (0001: pool_applications.pool_id references pools on delete
-- cascade) — so marking an application "Alloted" and later removing the
-- pool silently erases it from both the Allotments and Profit & Loss
-- pages. Once an application is alloted, that result is a fact of record
-- (what actually happened), not pool-scoped working state — it should
-- outlive the pool.
--
-- allotment_records is a permanent, denormalized snapshot taken the moment
-- an application is marked "alloted", kept in sync with amount/payment/
-- remarks edits made afterward while the source row still exists. Every
-- reference back to a live table is ON DELETE SET NULL, never CASCADE, so
-- nothing can ever delete a row here — pool/application/PAN deletion just
-- freezes it (application_id/pool_id/pan_card_id go null) instead of
-- removing it. Display fields are copied in as plain text/values so the
-- page never needs a join back to tables that may no longer have the row.

create table public.allotment_records (
  id uuid primary key default gen_random_uuid(),

  -- Soft links to the live rows this was snapshotted from. Non-null only
  -- while the source application (and its pool) still exists; a viewer can
  -- use "application_id is null" to know a record has outlived its pool.
  application_id uuid unique references public.pool_applications (id) on delete set null,
  pool_id uuid references public.pools (id) on delete set null,
  ipo_id uuid references public.ipos (id) on delete set null,
  pan_card_id uuid references public.pan_cards (id) on delete set null,

  -- Denormalized snapshot — frozen at alloted-time (pool/ipo/category/pan
  -- names) or kept current via the sync trigger (amounts/payment/remarks),
  -- so display never depends on the soft links above still resolving.
  pool_name text not null,
  ipo_name text not null,
  listing_date date,
  category text not null check (category in ('retail', 'shni', 'bhni')),
  pan_number text not null,
  pan_label text,
  applicant_profile_id uuid not null references public.profiles (id) on delete cascade,
  applicant_name text not null,

  amount_deducted numeric,
  amount_received numeric,
  gross_profit numeric generated always as (amount_received - amount_deducted) stored,
  tax numeric generated always as (greatest(amount_received - amount_deducted, 0) * 0.208) stored,
  net_profit numeric generated always as (
    (amount_received - amount_deducted) - greatest(amount_received - amount_deducted, 0) * 0.208
  ) stored,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'done')),
  remarks text,
  last_modified_by text,

  alloted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- allotment_record_members: frozen clubbing roster for a record. Created
-- right after allotment_records (before either table's RLS/policies) since
-- allotment_records' own SELECT policy below needs to reference it.
-- ============================================================
create table public.allotment_record_members (
  allotment_record_id uuid not null references public.allotment_records (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  member_name text not null,
  pan_card_id uuid references public.pan_cards (id) on delete set null,
  pan_number text,
  pan_label text,
  primary key (allotment_record_id, profile_id)
);

alter table public.allotment_records enable row level security;

-- Same audience as the Profit & Loss / Allotments pages today: the
-- applicant, or anyone clubbed onto the application — but resolved from
-- this table's own frozen membership roster, not live pool membership,
-- since that's exactly what disappears with the pool.
create policy "applicant and clubbed members can view an allotment record"
  on public.allotment_records for select
  using (
    auth.uid() = applicant_profile_id
    or exists (
      select 1 from public.allotment_record_members arm
      where arm.allotment_record_id = allotment_records.id and arm.profile_id = auth.uid()
    )
  );

-- No insert/update/delete policy for regular users — every write happens
-- through sync_allotment_record() below (SECURITY DEFINER), so this table
-- is effectively append/sync-only from the app's perspective and can never
-- be edited or deleted by a client query, including the applicant's own.

alter table public.allotment_record_members enable row level security;

create policy "applicant and fellow members can view a record's roster"
  on public.allotment_record_members for select
  using (
    exists (
      select 1 from public.allotment_records ar
      where ar.id = allotment_record_members.allotment_record_id and ar.applicant_profile_id = auth.uid()
    )
    or exists (
      select 1 from public.allotment_record_members self
      where self.allotment_record_id = allotment_record_members.allotment_record_id and self.profile_id = auth.uid()
    )
  );

-- ============================================================
-- sync_allotment_record: snapshot/refresh one application's permanent
-- record. Called from triggers below whenever a pool_applications row is
-- (or becomes) alloted, or its clubbing roster changes while alloted.
-- SECURITY DEFINER since it needs to read/write across pools/ipos/profiles
-- regardless of the triggering row's own RLS visibility.
-- ============================================================
create function public.sync_allotment_record(p_application_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_app record;
  v_pool record;
  v_pan record;
  v_applicant_name text;
  v_record_id uuid;
begin
  select id, pool_id, pan_card_id, allotment_status, amount_deducted, amount_received,
         payment_status, remarks, last_modified_by
    into v_app
  from public.pool_applications
  where id = p_application_id;

  -- Row gone, or no longer alloted (e.g. flipped back before this synced) —
  -- nothing to snapshot. An already-existing permanent record is left
  -- untouched either way; it never gets deleted from here.
  if v_app.id is null or v_app.allotment_status <> 'alloted' then
    return;
  end if;

  select p.name as pool_name, p.category, p.ipo_id, i.name as ipo_name, i.listing_date
    into v_pool
  from public.pools p
  join public.ipos i on i.id = p.ipo_id
  where p.id = v_app.pool_id;

  select pc.pan_number, pc.label, pc.owner_id
    into v_pan
  from public.pan_cards pc
  where pc.id = v_app.pan_card_id;

  select display_name into v_applicant_name from public.profiles where id = v_pan.owner_id;

  insert into public.allotment_records (
    application_id, pool_id, ipo_id, pan_card_id,
    pool_name, ipo_name, listing_date, category, pan_number, pan_label,
    applicant_profile_id, applicant_name,
    amount_deducted, amount_received, payment_status, remarks, last_modified_by
  ) values (
    v_app.id, v_app.pool_id, v_pool.ipo_id, v_app.pan_card_id,
    v_pool.pool_name, v_pool.ipo_name, v_pool.listing_date, v_pool.category, v_pan.pan_number, v_pan.label,
    v_pan.owner_id, coalesce(v_applicant_name, 'Unknown'),
    v_app.amount_deducted, v_app.amount_received, v_app.payment_status, v_app.remarks, v_app.last_modified_by
  )
  on conflict (application_id) do update set
    amount_deducted = excluded.amount_deducted,
    amount_received = excluded.amount_received,
    payment_status = excluded.payment_status,
    remarks = excluded.remarks,
    last_modified_by = excluded.last_modified_by
  returning id into v_record_id;

  -- Refresh the frozen roster from the live clubbing state every sync —
  -- cheap (a pool's clubbing count is small) and keeps it accurate for as
  -- long as the source rows still exist to read from.
  delete from public.allotment_record_members where allotment_record_id = v_record_id;

  insert into public.allotment_record_members (allotment_record_id, profile_id, member_name, pan_card_id, pan_number, pan_label)
  select v_record_id, pam.profile_id, coalesce(pr.display_name, 'Member'), pam.pan_card_id, pc2.pan_number, pc2.label
  from public.pool_application_members pam
  left join public.profiles pr on pr.id = pam.profile_id
  left join public.pan_cards pc2 on pc2.id = pam.pan_card_id
  where pam.application_id = v_app.id;
end;
$$;

create function public.trg_sync_allotment_record_from_application()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if NEW.allotment_status = 'alloted' then
    perform public.sync_allotment_record(NEW.id);
  end if;
  return NEW;
end;
$$;

create trigger sync_allotment_record_on_application_change
  after insert or update of allotment_status, amount_deducted, amount_received, payment_status, remarks, last_modified_by
  on public.pool_applications
  for each row
  execute function public.trg_sync_allotment_record_from_application();

-- Clubbing can change (join/leave) after an application is already
-- alloted, so keep the frozen roster current for as long as the live rows
-- still exist too — otherwise a late join/leave would silently diverge
-- from the permanent record.
create function public.trg_sync_allotment_record_from_membership()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.sync_allotment_record(coalesce(NEW.application_id, OLD.application_id));
  return coalesce(NEW, OLD);
end;
$$;

create trigger sync_allotment_record_on_membership_change
  after insert or delete on public.pool_application_members
  for each row
  execute function public.trg_sync_allotment_record_from_membership();

-- These three are internal — only ever invoked by the triggers above (which
-- run as the SECURITY DEFINER owner regardless of the calling role's own
-- grants), never called directly by the app. New functions default to
-- PUBLIC execute in Postgres, so revoke it explicitly: nothing about
-- sync_allotment_record validates the caller, since it trusts being
-- reached only from a trigger already scoped to one row.
revoke execute on function public.sync_allotment_record(uuid) from public;
revoke execute on function public.trg_sync_allotment_record_from_application() from public;
revoke execute on function public.trg_sync_allotment_record_from_membership() from public;

-- Backfill: snapshot every application that's already alloted today, so
-- existing data isn't left out of the new permanent table.
do $$
declare
  v_id uuid;
begin
  for v_id in select id from public.pool_applications where allotment_status = 'alloted' loop
    perform public.sync_allotment_record(v_id);
  end loop;
end $$;
