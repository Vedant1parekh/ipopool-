"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { manualTriggerIpoSync } from "./sync-actions";
import { SYNC_BATCH_COOLDOWN_SECONDS } from "@/lib/ipo-sync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// TEMPORARY test UI — remove once manual testing of the sync is done.

const initialState = { message: null as string | null };

function secondsRemaining(lastBatchAt: string | null): number {
  if (!lastBatchAt) return 0;
  const elapsedMs = Date.now() - new Date(lastBatchAt).getTime();
  const remainingMs = SYNC_BATCH_COOLDOWN_SECONDS * 1000 - elapsedMs;
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

export function SyncStatusDialog({ lastBatchAt }: { lastBatchAt: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(() => secondsRemaining(lastBatchAt));

  useEffect(() => {
    setSecondsLeft(secondsRemaining(lastBatchAt));
    const interval = setInterval(() => setSecondsLeft(secondsRemaining(lastBatchAt)), 1000);
    return () => clearInterval(interval);
  }, [lastBatchAt]);

  const [state, formAction, pending] = useActionState(async () => {
    const result = await manualTriggerIpoSync();
    router.refresh();
    if (result.skipped) return { message: "Still on cooldown — nothing was fetched." };
    if ("error" in result) return { message: `Error: ${result.error}` };
    return { message: `Fetched ${result.pagesFetched} page(s), synced ${result.synced} IPO(s).` };
  }, initialState);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>IPO sync triggered</AlertDialogTitle>
          <AlertDialogDescription>
            6 API requests to ipoalerts.in have already been triggered for this login. The provider only allows 6
            requests per minute, so please wait before triggering more.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => formAction()} disabled={secondsLeft > 0 || pending}>
            {secondsLeft > 0 ? `Retrigger in ${secondsLeft}s` : pending ? "Triggering..." : "Retrigger now"}
          </AlertDialogAction>
        </AlertDialogFooter>
        {state.message && <p className="text-sm text-muted-foreground">{state.message}</p>}
      </AlertDialogContent>
    </AlertDialog>
  );
}
