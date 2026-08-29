import { requireUser } from "@/lib/supabase/require-user";
import type { PanCard } from "@/lib/types";
import { PanForm } from "./pan-form";
import { removePanCard } from "./actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PanCardsPage() {
  const { supabase, user } = await requireUser();

  const { data: panCards } = await supabase
    .from("pan_cards")
    .select("id, owner_id, pan_number, label, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .returns<PanCard[]>();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">My PAN cards</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        You need at least one PAN card on file before you can join a pool.
      </p>

      <PanForm />

      <div className="mt-6 flex flex-col gap-2">
        {panCards?.map((card) => (
          <div
            key={card.id}
            className="flex items-center justify-between rounded-lg border p-3 text-sm"
          >
            <div>
              <span className="font-mono">{card.pan_number}</span>
              {card.label && <span className="ml-2 text-muted-foreground">{card.label}</span>}
            </div>
            <form action={removePanCard.bind(null, card.id)}>
              <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                Remove
              </Button>
            </form>
          </div>
        ))}
        {(!panCards || panCards.length === 0) && (
          <p className="text-sm text-muted-foreground">No PAN cards yet — add one above.</p>
        )}
      </div>
    </main>
  );
}
