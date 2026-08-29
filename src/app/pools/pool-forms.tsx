"use client";

import { useActionState } from "react";
import { createPool, joinPool } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };

export function CreatePoolForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await createPool(formData)) ?? initialState;
  }, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a pool</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-2">
          <Input name="name" required placeholder="e.g. Family Pool" />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Creating..." : "Create pool"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

export function JoinPoolForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await joinPool(formData)) ?? initialState;
  }, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Join a pool</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-2">
          <Input name="inviteCode" required placeholder="Invite code" />
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Joining..." : "Join pool"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
