"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";

async function userHasPanCard(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  const { count } = await supabase
    .from("pan_cards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  return (count ?? 0) > 0;
}

export async function createPool(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return { error: "Pool name is required." };
  }

  if (!(await userHasPanCard(supabase, user.id))) {
    return { error: "Add at least one PAN card before creating a pool." };
  }

  const inviteCode = randomBytes(4).toString("hex");

  const { data: pool, error } = await supabase
    .from("pools")
    .insert({ name, owner_id: user.id, invite_code: inviteCode })
    .select("id")
    .single();

  if (error || !pool) {
    return { error: error?.message ?? "Could not create pool." };
  }

  const { error: memberError } = await supabase
    .from("pool_members")
    .insert({ pool_id: pool.id, profile_id: user.id });

  if (memberError) {
    return { error: memberError.message };
  }

  redirect(`/pools/${pool.id}`);
}

export async function addApplication(poolId: string, formData: FormData) {
  const { supabase, user } = await requireUser();

  const ipoId = String(formData.get("ipoId") ?? "");
  const panCardId = String(formData.get("panCardId") ?? "");
  const category = String(formData.get("category") ?? "retail");
  const status = String(formData.get("status") ?? "applied");

  if (!ipoId || !panCardId) {
    return { error: "Choose an IPO and a PAN card." };
  }

  const { count: ownsThisPan } = await supabase
    .from("pan_cards")
    .select("id", { count: "exact", head: true })
    .eq("id", panCardId)
    .eq("owner_id", user.id);

  if (!ownsThisPan) {
    return { error: "You can only log applications for your own PAN cards." };
  }

  const { error } = await supabase.from("pool_applications").insert({
    pool_id: poolId,
    ipo_id: ipoId,
    pan_card_id: panCardId,
    category,
    status,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/pools/${poolId}`);
  return { error: null };
}

export async function joinPool(formData: FormData) {
  const { supabase } = await requireUser();
  const inviteCode = String(formData.get("inviteCode") ?? "").trim().toLowerCase();

  if (!inviteCode) {
    return { error: "Enter an invite code." };
  }

  const { data: poolId, error } = await supabase.rpc("join_pool_by_invite_code", {
    code: inviteCode,
  });

  if (error || !poolId) {
    return { error: error?.message ?? "Could not join pool." };
  }

  redirect(`/pools/${poolId}`);
}
