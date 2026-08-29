import { requireUser } from "@/lib/supabase/require-user";
import type { PanCard } from "@/lib/types";
import { PanForm } from "./pan-form";
import { removePanCard } from "./actions";

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
      <p className="mb-6 text-sm text-gray-600">
        You need at least one PAN card on file before you can join a pool.
      </p>

      <PanForm />

      <ul className="mt-6 flex flex-col gap-2">
        {panCards?.map((card) => (
          <li key={card.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <div>
              <span className="font-mono">{card.pan_number}</span>
              {card.label && <span className="ml-2 text-gray-500">{card.label}</span>}
            </div>
            <form action={removePanCard.bind(null, card.id)}>
              <button type="submit" className="text-gray-400 underline hover:text-red-600">
                Remove
              </button>
            </form>
          </li>
        ))}
        {(!panCards || panCards.length === 0) && (
          <p className="text-sm text-gray-500">No PAN cards yet — add one above.</p>
        )}
      </ul>
    </main>
  );
}
