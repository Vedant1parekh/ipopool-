"use server";

import { syncOpenIposIfNeeded, syncSinglePage } from "@/lib/ipo-sync";

// TEMPORARY test hook — remove once manual testing of the sync is done.
// Lets the sync-status dialog manually retrigger a batch; the cooldown is
// still enforced server-side via claim_ipo_sync_batch, so this is a safe
// no-op if called before the wait is actually up.
export async function manualTriggerIpoSync() {
  return syncOpenIposIfNeeded();
}

// TEMPORARY test hook — remove once manual testing of the sync is done.
// Recovery path for a page the cron's batch cursor never actually hit.
export async function manualTriggerSyncPage(page: number) {
  return syncSinglePage(page);
}
