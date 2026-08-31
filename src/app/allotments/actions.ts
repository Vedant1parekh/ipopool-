"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import type { AllotmentStatus } from "@/lib/types";

export async function setAllotmentStatus(applicationId: string, status: AllotmentStatus) {
  const { supabase, user } = await requireUser();
  const displayName = (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "user";

  const { error } = await supabase
    .from("pool_applications")
    .update({ allotment_status: status, last_modified_by: displayName })
    .eq("id", applicationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/allotments");
}
