"use client";

import { useActionState } from "react";
import { addPanCard } from "./actions";

const initialState = { error: null as string | null };

export function PanForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return addPanCard(formData);
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        PAN number
        <input
          name="panNumber"
          required
          maxLength={10}
          placeholder="ABCDE1234F"
          className="rounded-md border px-3 py-2 uppercase"
        />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Label (optional)
        <input name="label" placeholder="e.g. My name, Dad, V2" className="rounded-md border px-3 py-2" />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add PAN"}
      </button>
      {state.error && <p className="text-sm text-red-600 sm:basis-full">{state.error}</p>}
    </form>
  );
}
