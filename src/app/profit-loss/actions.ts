"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

export async function setApplicationFinancials(
  applicationId: string,
  input: { amountDeducted: number; amountReceived: number; paymentStatus: string; remarks: string },
) {
  const { supabase } = await requireUser();

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
    })
    .eq("id", applicationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profit-loss");
  return { error: null };
}
