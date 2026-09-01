import { requireUser } from "@/lib/supabase/require-user";
import type { PanCard } from "@/lib/types";
import { PanForm } from "./pan-form";
import { PanCardRow } from "./pan-card-row";

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
          <PanCardRow key={card.id} card={card} />
        ))}
        {(!panCards || panCards.length === 0) && (
          <p className="text-sm text-muted-foreground">No PAN cards yet — add one above.</p>
        )}
      </div>
    </main>
  );
}
