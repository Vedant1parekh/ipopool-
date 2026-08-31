"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { createPool, joinPool } from "./actions";
import type { Ipo, IpoType } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };
const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function CreatePoolForm({ ipos }: { ipos: Ipo[] }) {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return (await createPool(formData)) ?? initialState;
  }, initialState);
  const [type, setType] = useState<IpoType>("mainboard");
  const filteredIpos = useMemo(() => ipos.filter((ipo) => ipo.type === type), [ipos, type]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Create a pool</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>IPO type</Label>
            <div className="inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
              {(["mainboard", "sme"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors ${
                    type === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ipoId">IPO</Label>
            <select id="ipoId" name="ipoId" required className={selectClass}>
              <option value="">Select an IPO</option>
              {filteredIpos.map((ipo) => (
                <option key={ipo.id} value={ipo.id}>
                  {ipo.name}
                </option>
              ))}
            </select>
            {filteredIpos.length === 0 && (
              <p className="text-xs text-muted-foreground">No {type} IPOs open/upcoming right now.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <select id="category" name="category" required className={selectClass}>
              <option value="retail">Retail</option>
              <option value="shni">SHNI</option>
              <option value="bhni">BHNI</option>
            </select>
          </div>

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
