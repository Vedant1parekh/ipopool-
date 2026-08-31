"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

export async function setApplicationFinancials(
  applicationId: string,
  input: { amountDeducted: number; amountReceived: number; paymentStatus: string; remarks: string },
) {
  const { supabase, user } = await requireUser();
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "user";

  if (Number.isNaN(input.amountDeducted) || Number.isNaN(input.amountReceived)) {
    return { error: "Amounts must be numbers." };
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
