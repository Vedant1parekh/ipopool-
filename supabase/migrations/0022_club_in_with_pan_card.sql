-- Clubbing was purely profile-level (just "I'm co-participating"), with no
-- record of which of the clubbing member's own PAN cards backs it. Members
-- now pick a specific card when clubbing in, so the same card can't be
-- reused against the same application owner more than once (checked
-- app-side per (clubber, owner) pair, not here — mirrors the one-PAN-per-
-- IPO rule for direct applications).
--
-- Nullable so existing club-in rows (recorded before this column existed)
-- remain valid; every new club-in going forward provides one.

alter table public.pool_application_members
  add column pan_card_id uuid references public.pan_cards (id) on delete cascade;

drop policy if exists "pool members can club onto a pending application, once, not their own PAN" on public.pool_application_members;

create policy "pool members can club onto a pending application, once, not their own PAN"
  on public.pool_application_members for insert
  with check (
    auth.uid() = profile_id
    and (
      pan_card_id is null
      or exists (select 1 from public.pan_cards where id = pan_card_id and owner_id = profile_id)
    )
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
