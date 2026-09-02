"use client";

import { useActionState } from "react";
import { addApplication, clubOnApplication, unclubFromApplication } from "../actions";
import type { PanCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };

const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

// Joining picks which of the clubbing member's own PAN cards backs it (each
// card can only club onto one owner's applications once); leaving doesn't
// need one, since it just frees that same card back up.
export function ClubButton({
  poolId,
  applicationId,
  isMember,
  disabledReason,
  panCards,
}: {
  poolId: string;
  applicationId: string;
  isMember: boolean;
  disabledReason?: string;
  panCards: PanCard[];
}) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    if (isMember) {
      return (await unclubFromApplication(poolId, applicationId)) ?? initialState;
    }
    const panCardId = String(formData.get("panCardId") ?? "");
    return (await clubOnApplication(poolId, applicationId, panCardId)) ?? initialState;
  }, initialState);

  if (isMember) {
    return (
      <form action={formAction} className="flex flex-col items-end gap-1">
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending || !!disabledReason}
          title={disabledReason}
        >
          {pending ? "Saving..." : "Remove club in"}
        </Button>
        {disabledReason && <p className="text-xs text-muted-foreground">{disabledReason}</p>}
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1">
        <select name="panCardId" required disabled={pending} className={selectClass}>
          {panCards.map((pan) => (
            <option key={pan.id} value={pan.id}>
              {pan.label ? `${pan.label} (${pan.pan_number})` : pan.pan_number}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="secondary" disabled={pending}>
          {pending ? "Saving..." : "Club in"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function ApplicationForm({ poolId, panCards }: { poolId: string; panCards: PanCard[] }) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await addApplication(poolId, formData)) ?? initialState;
  }, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log an application</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="panCardId">Your PAN card</Label>
              <select id="panCardId" name="panCardId" required className={selectClass}>
                <option value="">Select a PAN</option>
                {panCards.map((pan) => (
                  <option key={pan.id} value={pan.id}>
                    {pan.label ? `${pan.label} (${pan.pan_number})` : pan.pan_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select id="status" name="status" className={selectClass}>
                <option value="applied">Applied</option>
                <option value="na">Not applicable</option>
              </select>
            </div>
          </div>

          <Button type="submit" disabled={pending || panCards.length === 0} className="self-start">
            {pending ? "Saving..." : "Save"}
          </Button>
          {panCards.length === 0 && (
            <p className="text-sm text-warning-foreground">
              Add a PAN card to your profile before logging an application.
            </p>
          )}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
