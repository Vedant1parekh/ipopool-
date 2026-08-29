-- IPO PooL v1 schema
-- Run via `supabase db push` or paste into the Supabase SQL editor.

-- ============================================================
-- profiles: one row per auth.users, created on signup
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are insertable by their owner"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- pan_cards: PAN numbers a user has added, always self-owned
-- ============================================================
create table public.pan_cards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  pan_number text not null unique,
  label text,
  created_at timestamptz not null default now(),
  constraint pan_number_format check (pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]{1}$')
);

alter table public.pan_cards enable row level security;

create policy "users manage only their own PAN cards"
  on public.pan_cards for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================================
-- ipos: public read-only catalog, written only by the sync job
-- ============================================================
create table public.ipos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('mainboard', 'sme')),
  open_date date,
  close_date date,
  listing_date date,
  price_band_min numeric,
  price_band_max numeric,
  lot_size integer,
  status text not null default 'upcoming' check (status in ('upcoming', 'open', 'closed', 'listed')),
  source text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  unique (name, type)
);

alter table public.ipos enable row level security;

create policy "ipos are readable by anyone signed in"
  on public.ipos for select
  using (auth.role() = 'authenticated');

-- Writes to `ipos` are performed by the sync job using the service role key,
-- which bypasses RLS, so no insert/update policy is defined for normal users.

-- ============================================================
-- pools: a standing group of trusted people
-- ============================================================
create table public.pools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.pools enable row level security;

create table public.pool_members (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (pool_id, profile_id)
);

alter table public.pool_members enable row level security;

-- Helper: is the current user a member of a given pool?
create function public.is_pool_member(target_pool_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.pool_members
    where pool_id = target_pool_id and profile_id = auth.uid()
  );
$$;

create policy "pool members can view their pools"
  on public.pools for select
  using (public.is_pool_member(id));

create policy "any signed-in user can create a pool"
  on public.pools for insert
  with check (auth.uid() = owner_id);

create policy "members can view the membership list of their own pools"
  on public.pool_members for select
  using (public.is_pool_member(pool_id));

create policy "a signed-in user can join a pool via invite (insert their own membership)"
  on public.pool_members for insert
  with check (
    auth.uid() = profile_id
    and exists (select 1 from public.pan_cards where owner_id = auth.uid())
  );

-- ============================================================
-- pool_applications: which PAN applied to which IPO, for which pool
-- ============================================================
create table public.pool_applications (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools (id) on delete cascade,
  ipo_id uuid not null references public.ipos (id) on delete cascade,
  pan_card_id uuid not null references public.pan_cards (id) on delete cascade,
  category text not null default 'retail' check (category in ('retail', 'shni', 'bhni')),
  status text not null default 'applied' check (status in ('applied', 'na')),
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.pool_applications enable row level security;

create policy "pool members can view applications in their pools"
  on public.pool_applications for select
  using (public.is_pool_member(pool_id));

create policy "pool members can record applications in their pools"
  on public.pool_applications for insert
  with check (
    public.is_pool_member(pool_id)
    and created_by = auth.uid()
  );

-- ============================================================
-- profit_records: strictly per-user profit/loss ledger
-- ============================================================
create table public.profit_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  pan_card_id uuid references public.pan_cards (id) on delete set null,
  ipo_id uuid references public.ipos (id) on delete set null,
  amount_deducted numeric not null default 0,
  amount_received numeric not null default 0,
  gross_profit numeric generated always as (amount_received - amount_deducted) stored,
  tax numeric not null default 0,
  net_profit numeric generated always as (amount_received - amount_deducted - tax) stored,
  created_at timestamptz not null default now()
);

alter table public.profit_records enable row level security;

create policy "users see only their own profit records"
  on public.profit_records for select
  using (auth.uid() = profile_id);

create policy "users manage only their own profit records"
  on public.profit_records for insert
  with check (auth.uid() = profile_id);

create policy "users update only their own profit records"
  on public.profit_records for update
  using (auth.uid() = profile_id);
