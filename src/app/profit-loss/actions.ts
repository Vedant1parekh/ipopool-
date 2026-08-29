"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

export async function addProfitRecord(formData: FormData) {
  const { supabase, user } = await requireUser();

  const ipoId = String(formData.get("ipoId") ?? "") || null;
  const panCardId = String(formData.get("panCardId") ?? "") || null;
  const amountDeducted = Number(formData.get("amountDeducted") ?? 0);
  const amountReceived = Number(formData.get("amountReceived") ?? 0);
  const tax = Number(formData.get("tax") ?? 0);

  if (Number.isNaN(amountDeducted) || Number.isNaN(amountReceived) || Number.isNaN(tax)) {
    return { error: "Amounts must be numbers." };
  }

  const { error } = await supabase.from("profit_records").insert({
    profile_id: user.id,
    ipo_id: ipoId,
    pan_card_id: panCardId,
    amount_deducted: amountDeducted,
    amount_received: amountReceived,
    tax,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profit-loss");
  return { error: null };
}
