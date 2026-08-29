"use client";

import { useActionState } from "react";
import { createPool, joinPool } from "./actions";

const initialState = { error: null as string | null };

export function CreatePoolForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await createPool(formData)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="font-medium">Create a pool</h2>
      <input
        name="name"
        required
        placeholder="e.g. Family Pool"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create pool"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function JoinPoolForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await joinPool(formData)) ?? initialState;
  }, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-lg border p-4">
      <h2 className="font-medium">Join a pool</h2>
      <input
        name="inviteCode"
        required
        placeholder="Invite code"
        className="rounded-md border px-3 py-2 text-sm"
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {pending ? "Joining..." : "Join pool"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
