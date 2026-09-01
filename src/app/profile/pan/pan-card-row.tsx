"use client";

import { useActionState, useEffect, useState } from "react";
import { removePanCard, updatePanCard } from "./actions";
import type { PanCard } from "@/lib/types";
import { Input } from "@/components/ui/input";
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

export function PanCardRow({ card }: { card: PanCard }) {
  const [isEditing, setIsEditing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [state, formAction, pending] = useActionState(async (_prev: typeof initialState, formData: FormData) => {
    const result = await updatePanCard(card.id, formData);
    if (!result.error) setIsEditing(false);
    return result;
  }, initialState);

  useEffect(() => {
    if (state.duplicate) setDialogOpen(true);
  }, [state]);

  if (isEditing) {
    return (
      <form
        action={formAction}
        className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-end"
      >
        <Input
          name="panNumber"
          defaultValue={card.pan_number}
          required
          maxLength={10}
          className="uppercase sm:flex-1"
        />
        <Input name="label" defaultValue={card.label ?? ""} required className="sm:flex-1" />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        </div>
        {state.error && !state.duplicate && (
          <p className="text-xs text-destructive sm:basis-full">{state.error}</p>
        )}

        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>PAN already registered</AlertDialogTitle>
              <AlertDialogDescription>
                You cannot use this PAN — it&apos;s already registered by another user.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setDialogOpen(false)}>Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border p-3 text-sm">
      <div>
        <span className="font-mono">{card.pan_number}</span>
        {card.label && <span className="ml-2 text-muted-foreground">{card.label}</span>}
      </div>
      <div className="flex gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <form action={removePanCard.bind(null, card.id)}>
          <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
            Remove
          </Button>
        </form>
      </div>
    </div>
  );
}
