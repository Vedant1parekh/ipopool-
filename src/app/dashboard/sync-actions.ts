"use server";

import { syncOpenIposIfNeeded } from "@/lib/ipo-sync";

// TEMPORARY test hook — remove once manual testing of the sync is done.
// Lets the sync-status dialog manually retrigger a batch; the cooldown is
// still enforced server-side via claim_ipo_sync_batch, so this is a safe
// no-op if called before the wait is actually up.
export async function manualTriggerIpoSync() {
  return syncOpenIposIfNeeded();
}
