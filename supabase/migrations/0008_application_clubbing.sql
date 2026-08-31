-- Clubbing: a PAN can only have one application per pool (SEBI allows one
-- application per PAN per IPO anyway), but other pool members can "club"
-- onto that single application as co-participants instead of being turned
-- away once their own PAN quota model doesn't fit. Clubbing closes once the
-- allotment result is in — no benefit to joining after the fact.

alter table public.pool_applications
  add constraint pool_applications_pool_pan_unique unique (pool_id, pan_card_id);

create table public.pool_application_members (
  application_id uuid not null references public.pool_applications (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (application_id, profile_id)
);

alter table public.pool_application_members enable row level security;

create policy "pool members can view co-members of applications in their pools"
  on public.pool_application_members for select
  using (
    exists (
      select 1 from public.pool_applications pa
      where pa.id = application_id and public.is_pool_member(pa.pool_id)
    )
  );

create policy "pool members can club onto a pending application, once, not their own PAN"
  on public.pool_application_members for insert
  with check (
    auth.uid() = profile_id
    and exists (
      select 1
      from public.pool_applications pa
      join public.pan_cards pc on pc.id = pa.pan_card_id
      where pa.id = application_id
        and public.is_pool_member(pa.pool_id)
        and pa.allotment_status = 'pending'
        and pc.owner_id <> profile_id
    )
  );
