"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { manualTriggerIpoSync, manualTriggerSyncPage } from "./sync-actions";
import { SYNC_BATCH_COOLDOWN_SECONDS } from "@/lib/ipo-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// TEMPORARY test UI — remove once manual testing of the sync is done.
// The dashboard page always renders this (for the test account) so it
// stays visible across tab navigation, not just right after login.

function secondsRemaining(lastBatchAt: string | null): number {
  if (!lastBatchAt) return 0;
  const elapsedMs = Date.now() - new Date(lastBatchAt).getTime();
  const remainingMs = SYNC_BATCH_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

const TONE_CLASSES = {
  pending: "border-warning/40 bg-warning/10",
  done: "border-success/40 bg-success/10",
  error: "border-destructive/40 bg-destructive/10",
} as const;

export function SyncStatusBanner({
  lastBatchAt,
  initialDone,
  initialMessage,
}: {
  lastBatchAt: string | null;
  initialDone: boolean;
  initialMessage: string | null;
}) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsRemaining(lastBatchAt));

  useEffect(() => {
    setDone(initialDone);
  }, [initialDone]);

  useEffect(() => {
    setSecondsLeft(secondsRemaining(lastBatchAt));
    const interval = setInterval(() => setSecondsLeft(secondsRemaining(lastBatchAt)), 1000);
    return () => clearInterval(interval);
  }, [lastBatchAt]);

  const [state, formAction, pending] = useActionState(
    async (prev: { message: string | null }) => {
      const result = await manualTriggerIpoSync();
      router.refresh();
      if (result.skipped) return prev;
      if ("error" in result) return { message: `Error: ${result.error}` };
      setDone(result.done);
      return { message: `Fetched ${result.pagesFetched} page(s), synced ${result.synced} IPO(s).` };
    },
    { message: initialMessage },
  );

  const isError = !done && state.message?.startsWith("Error:");
  const tone = done ? "done" : isError ? "error" : "pending";
  const disabled = done || secondsLeft > 0 || pending;

  const [pageInput, setPageInput] = useState("");
  const [pageState, pageFormAction, pagePending] = useActionState(
    async (prev: { message: string | null }) => {
      const page = Number(pageInput);
      if (!Number.isInteger(page) || page < 1) {
        return { message: "Error: enter a valid page number." };
      }
      const result = await manualTriggerSyncPage(page);
      router.refresh();
      if ("error" in result) return { message: `Error: ${result.error}` };
      return { message: `Page ${result.page}: synced ${result.synced} IPO(s).` };
    },
    { message: null as string | null },
  );
  const pageDisabled = secondsLeft > 0 || pagePending || !pageInput;

  return (
    <div className={`mb-6 rounded-lg border p-4 ${TONE_CLASSES[tone]}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-sm">
          <p className="font-medium">
            {done ? "All IPOs for today have been fetched" : "IPO sync triggered (test mode)"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {done
              ? "We don't need to hit the ipoalerts.in API again until tomorrow."
              : "ipoalerts.in only allows 6 requests per minute, so batches are spaced out automatically."}
          </p>
          {!done && state.message && <p className="mt-1 font-medium">{state.message}</p>}
        </div>
        <Button size="sm" variant="outline" onClick={() => formAction()} disabled={disabled}>
          {done
            ? "Complete"
            : secondsLeft > 0
              ? `Retrigger in ${secondsLeft}s`
              : pending
                ? "Triggering..."
                : "Retrigger now"}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Missed page recovery
          <Input
            type="number"
            min={1}
            step={1}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            placeholder="Page #"
            className="h-8 w-24"
          />
        </label>
        <Button size="sm" variant="outline" onClick={() => pageFormAction()} disabled={pageDisabled}>
          {pagePending ? "Syncing..." : "Sync this page"}
        </Button>
        {pageState.message && <p className="w-full text-xs font-medium">{pageState.message}</p>}
      </div>
    </div>
  );
}
