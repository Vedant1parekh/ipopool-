-- pool_applications had no delete policy at all — no one could remove a
-- mistaken entry. Marking it "na" doesn't help either: the row still
-- exists, so the one-PAN-per-IPO cross-category check (which looks at row
-- existence, not status) keeps blocking that PAN from applying under the
-- correct category. The applicant can now delete their own application
-- outright, freeing the PAN for a different category of the same IPO.

create policy "the applicant can remove their own application"
  on public.pool_applications for delete
  using (
    exists (
      select 1 from public.pan_cards pc
      where pc.id = pool_applications.pan_card_id and pc.owner_id = auth.uid()
    )
  );
