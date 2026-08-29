"use client";

import { useActionState } from "react";
import { addProfitRecord } from "./actions";
import type { Ipo, PanCard } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };
const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProfitForm({ ipos, panCards }: { ipos: Ipo[]; panCards: PanCard[] }) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await addProfitRecord(formData)) ?? initialState;
  }, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log a profit / loss entry</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ipoId">IPO</Label>
              <select id="ipoId" name="ipoId" className={selectClass}>
                <option value="">Select an IPO</option>
                {ipos.map((ipo) => (
                  <option key={ipo.id} value={ipo.id}>
                    {ipo.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="panCardId">PAN card</Label>
              <select id="panCardId" name="panCardId" className={selectClass}>
                <option value="">Select a PAN</option>
                {panCards.map((pan) => (
                  <option key={pan.id} value={pan.id}>
                    {pan.label ? `${pan.label} (${pan.pan_number})` : pan.pan_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amountDeducted">Amount deducted (₹)</Label>
              <Input id="amountDeducted" name="amountDeducted" type="number" step="0.01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amountReceived">Amount received (₹)</Label>
              <Input id="amountReceived" name="amountReceived" type="number" step="0.01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tax">Tax (₹)</Label>
              <Input id="tax" name="tax" type="number" step="0.01" defaultValue={0} />
            </div>
          </div>
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Saving..." : "Save entry"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
