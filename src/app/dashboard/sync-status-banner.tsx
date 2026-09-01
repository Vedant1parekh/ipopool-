"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { manualTriggerIpoSync } from "./sync-actions";
import { SYNC_BATCH_COOLDOWN_SECONDS } from "@/lib/ipo-sync";
import { Button } from "@/components/ui/button";

// TEMPORARY test UI — remove once manual testing of the sync is done.

function secondsRemaining(lastBatchAt: string | null): number {
  if (!lastBatchAt) return 0;
  const elapsedMs = Date.now() - new Date(lastBatchAt).getTime();
  const remainingMs = SYNC_BATCH_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function SyncStatusBanner({
  lastBatchAt,
  initialDone,
}: {
  lastBatchAt: string | null;
  initialDone: boolean;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsRemaining(lastBatchAt));

  useEffect(() => {
    setSecondsLeft(secondsRemaining(lastBatchAt));
    const interval = setInterval(() => setSecondsLeft(secondsRemaining(lastBatchAt)), 1000);
    return () => clearInterval(interval);
  }, [lastBatchAt]);

  const [state, formAction, pending] = useActionState(async (prev: { message: string | null }) => {
    const result = await manualTriggerIpoSync();
    router.refresh();
    if (result.skipped) return prev;
    if ("error" in result) return { message: `Error: ${result.error}` };
    setDone(result.done);
    return { message: `Fetched ${result.pagesFetched} page(s), synced ${result.synced} IPO(s).` };
  }, { message: null as string | null });

  const disabled = done || secondsLeft > 0 || pending;

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
      <p>
        6 API requests to ipoalerts.in have already been triggered for this login.
        {done
          ? " All available pages have been fetched (or today's 25-request cap was reached) — nothing left to sync until tomorrow."
          : " The provider only allows 6 requests per minute, so please wait before triggering more."}
        {!done && state.message && <span className="ml-1 font-medium">{state.message}</span>}
      </p>
      <Button size="sm" variant="outline" onClick={() => formAction()} disabled={disabled}>
        {done
          ? "Sync complete for today"
          : secondsLeft > 0
            ? `Retrigger in ${secondsLeft}s`
            : pending
              ? "Triggering..."
              : "Retrigger now"}
      </Button>
    </div>
  );
}
