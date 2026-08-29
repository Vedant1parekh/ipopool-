"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export async function addPanCard(formData: FormData) {
  const { supabase, user } = await requireUser();

  const panNumber = String(formData.get("panNumber") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim() || null;

  if (!PAN_REGEX.test(panNumber)) {
    return { error: "PAN must look like ABCDE1234F (5 letters, 4 digits, 1 letter)." };
  }

  const { error } = await supabase
    .from("pan_cards")
    .insert({ owner_id: user.id, pan_number: panNumber, label });

  if (error) {
    return { error: error.message.includes("duplicate") ? "That PAN is already registered." : error.message };
  }

  revalidatePath("/profile/pan");
  return { error: null };
}

export async function removePanCard(panCardId: string) {
  const { supabase, user } = await requireUser();

  await supabase.from("pan_cards").delete().eq("id", panCardId).eq("owner_id", user.id);

  revalidatePath("/profile/pan");
}
