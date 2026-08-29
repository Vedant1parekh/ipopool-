"use client";

import { useActionState } from "react";
import { addApplication } from "../actions";
import type { Ipo, PanCard } from "@/lib/types";

const initialState = { error: null as string | null };

export function ApplicationForm({
  poolId,
  ipos,
  panCards,
}: {
  poolId: string;
  ipos: Ipo[];
  panCards: PanCard[];
}) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await addApplication(poolId, formData)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="font-medium">Log an application</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          IPO
          <select name="ipoId" required className="rounded-md border px-3 py-2">
            <option value="">Select an IPO</option>
            {ipos.map((ipo) => (
              <option key={ipo.id} value={ipo.id}>
                {ipo.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Your PAN card
          <select name="panCardId" required className="rounded-md border px-3 py-2">
            <option value="">Select a PAN</option>
            {panCards.map((pan) => (
              <option key={pan.id} value={pan.id}>
                {pan.label ? `${pan.label} (${pan.pan_number})` : pan.pan_number}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Category
          <select name="category" className="rounded-md border px-3 py-2">
            <option value="retail">Retail</option>
            <option value="shni">SHNI</option>
            <option value="bhni">BHNI</option>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Status
          <select name="status" className="rounded-md border px-3 py-2">
            <option value="applied">Applied</option>
            <option value="na">Not applicable</option>
          </select>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending || panCards.length === 0}
        className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {panCards.length === 0 && (
        <p className="text-sm text-amber-700">Add a PAN card to your profile before logging an application.</p>
      )}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
