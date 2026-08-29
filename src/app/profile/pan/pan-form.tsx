"use client";

import { useActionState } from "react";
import { addPanCard } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const initialState = { error: null as string | null };

export function PanForm() {
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return addPanCard(formData);
  }, initialState);

  return (
    <Card>
      <CardContent className="pt-4">
        <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="panNumber">PAN number</Label>
            <Input
              id="panNumber"
              name="panNumber"
              required
              maxLength={10}
              placeholder="ABCDE1234F"
              className="uppercase"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="label">Label (optional)</Label>
            <Input id="label" name="label" placeholder="e.g. My name, Dad, V2" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding..." : "Add PAN"}
          </Button>
          {state.error && <p className="text-sm text-destructive sm:basis-full">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
