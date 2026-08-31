"use client";

import { useActionState, useState } from "react";
import { setAllotmentStatus } from "./actions";
import type { AllotmentStatus } from "@/lib/types";

const initialState = { error: null as string | null };

export function AllotmentChecklistItem({
  applicationId,
  initialStatus,
}: {
  applicationId: string;
  initialStatus: AllotmentStatus;
}) {
  const [checked, setChecked] = useState(initialStatus === "alloted");
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const status: AllotmentStatus = formData.get("alloted") === "on" ? "alloted" : "not_alloted";
    try {
      await setAllotmentStatus(applicationId, status);
      return initialState;
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Could not save." };
    }
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name="alloted"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Alloted
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
