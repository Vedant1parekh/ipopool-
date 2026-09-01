"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function isDuplicateError(message: string) {
  return message.toLowerCase().includes("duplicate");
}

export async function addPanCard(formData: FormData) {
  const { supabase, user } = await requireUser();

  const panNumber = String(formData.get("panNumber") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim();

  if (!PAN_REGEX.test(panNumber)) {
    return { error: "PAN must look like ABCDE1234F (5 letters, 4 digits, 1 letter).", duplicate: false };
  }

  if (!label) {
    return { error: "Label is required.", duplicate: false };
  }

  const { error } = await supabase
    .from("pan_cards")
    .insert({ owner_id: user.id, pan_number: panNumber, label });

  if (error) {
    if (isDuplicateError(error.message)) {
      return { error: "This PAN is already registered by another user.", duplicate: true };
    }
    return { error: error.message, duplicate: false };
  }

  revalidatePath("/profile/pan");
  return { error: null, duplicate: false };
}

export async function updatePanCard(panCardId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const panNumber = String(formData.get("panNumber") ?? "").trim().toUpperCase();
  const label = String(formData.get("label") ?? "").trim();

  if (!PAN_REGEX.test(panNumber)) {
    return { error: "PAN must look like ABCDE1234F (5 letters, 4 digits, 1 letter).", duplicate: false };
  }

  if (!label) {
    return { error: "Label is required.", duplicate: false };
  }

  const { error } = await supabase
    .from("pan_cards")
    .update({ pan_number: panNumber, label })
    .eq("id", panCardId)
    .eq("owner_id", user.id);

  if (error) {
    if (isDuplicateError(error.message)) {
      return { error: "This PAN is already registered by another user.", duplicate: true };
    }
    return { error: error.message, duplicate: false };
  }

  revalidatePath("/profile/pan");
  return { error: null, duplicate: false };
}

export async function removePanCard(panCardId: string) {
  const { supabase, user } = await requireUser();

  await supabase.from("pan_cards").delete().eq("id", panCardId).eq("owner_id", user.id);

  revalidatePath("/profile/pan");
}
