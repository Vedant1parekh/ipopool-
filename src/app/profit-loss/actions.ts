"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

// Only the applicant — the PAN's owner — can edit these shared fields;
// clubbed members can view the row but not change it.
export async function setApplicationFinancials(
  applicationId: string,
  input: { amountDeducted: number; amountReceived: number; paymentStatus: string; remarks: string },
) {
  const { supabase, user } = await requireUser();
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "user";

  if (Number.isNaN(input.amountDeducted) || Number.isNaN(input.amountReceived)) {
    return { error: "Amounts must be numbers." };
  }

  const { data: application } = await supabase
    .from("pool_applications")
    .select("pan_cards!inner(owner_id)")
    .eq("id", applicationId)
    .single<{ pan_cards: { owner_id: string } | null }>();

  if (application?.pan_cards?.owner_id !== user.id) {
    return { error: "Only the applicant can update these values." };
  }

  const { error } = await supabase
    .from("pool_applications")
    .update({
      amount_deducted: input.amountDeducted,
      amount_received: input.amountReceived,
      payment_status: input.paymentStatus === "done" ? "done" : "pending",
      remarks: input.remarks || null,
      last_modified_by: displayName,
    })
    .eq("id", applicationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profit-loss");
  return { error: null };
}
