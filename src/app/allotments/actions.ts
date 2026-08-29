"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import type { AllotmentStatus } from "@/lib/types";

export async function setAllotmentStatus(applicationId: string, status: AllotmentStatus) {
  const { supabase } = await requireUser();

  const { error } = await supabase
    .from("pool_applications")
    .update({ allotment_status: status })
    .eq("id", applicationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/allotments");
}
