"use client";

import { useActionState } from "react";
import { addProfitRecord } from "./actions";
import type { Ipo, PanCard } from "@/lib/types";

const initialState = { error: null as string | null };

export function ProfitForm({ ipos, panCards }: { ipos: Ipo[]; panCards: PanCard[] }) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await addProfitRecord(formData)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">Log a profit / loss entry</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          IPO
          <select name="ipoId" className="rounded-md border px-3 py-2">
            <option value="">Select an IPO</option>
            {ipos.map((ipo) => (
              <option key={ipo.id} value={ipo.id}>
                {ipo.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          PAN card
          <select name="panCardId" className="rounded-md border px-3 py-2">
            <option value="">Select a PAN</option>
            {panCards.map((pan) => (
              <option key={pan.id} value={pan.id}>
                {pan.label ? `${pan.label} (${pan.pan_number})` : pan.pan_number}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount deducted (₹)
          <input name="amountDeducted" type="number" step="0.01" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Amount received (₹)
          <input name="amountReceived" type="number" step="0.01" required className="rounded-md border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Tax (₹)
          <input name="tax" type="number" step="0.01" defaultValue={0} className="rounded-md border px-3 py-2" />
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save entry"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
