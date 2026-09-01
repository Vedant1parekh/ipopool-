"use client";

import { useActionState, useEffect, useState } from "react";
import { addPanCard } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const initialState = { error: null as string | null, duplicate: false };

export function PanForm() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    return addPanCard(formData);
  }, initialState);

  useEffect(() => {
    if (state.duplicate) setDialogOpen(true);
  }, [state]);

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
            <Label htmlFor="label">Label</Label>
            <Input id="label" name="label" required placeholder="e.g. My name, Dad, V2" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding..." : "Add PAN"}
          </Button>
          {state.error && !state.duplicate && (
            <p className="text-sm text-destructive sm:basis-full">{state.error}</p>
          )}
        </form>
      </CardContent>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>PAN already registered</AlertDialogTitle>
            <AlertDialogDescription>
              You cannot add this PAN — it&apos;s already registered by another user.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialogOpen(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
