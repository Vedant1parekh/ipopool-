"use client";

import { useActionState } from "react";
import { addApplication, clubOnApplication, unclubFromApplication } from "../actions";
import type { PanCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };

export function ClubButton({
  poolId,
  applicationId,
  isMember,
}: {
  poolId: string;
  applicationId: string;
  isMember: boolean;
}) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, _formData: FormData) => {
    const action = isMember ? unclubFromApplication : clubOnApplication;
    return (await action(poolId, applicationId)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" size="sm" variant={isMember ? "outline" : "secondary"} disabled={pending}>
        {pending ? "Saving..." : isMember ? "Remove club in" : "Club in"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
