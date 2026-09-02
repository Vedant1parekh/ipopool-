"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/require-user";
import type { ApplicationCategory } from "@/lib/types";

const CATEGORIES: ApplicationCategory[] = ["retail", "shni", "bhni"];

async function userHasPanCard(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string) {
  const { count } = await supabase
    .from("pan_cards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  return (count ?? 0) > 0;
}

export async function createPool(formData: FormData) {
  const { supabase, user } = await requireUser();
  const ipoId = String(formData.get("ipoId") ?? "");
  const category = String(formData.get("category") ?? "");

  if (!ipoId || !CATEGORIES.includes(category as ApplicationCategory)) {
    return { error: "Choose an IPO and a category." };
  }

  if (!(await userHasPanCard(supabase, user.id))) {
    return { error: "Add at least one PAN card before creating a pool." };
  }

  const { data: ipo, error: ipoError } = await supabase
    .from("ipos")
    .select("name")
    .eq("id", ipoId)
    .single();

  if (ipoError || !ipo) {
    return { error: "Selected IPO could not be found." };
  }

  const { count: existingPool } = await supabase
    .from("pools")
    .select("id", { count: "exact", head: true })
    .eq("ipo_id", ipoId)
    .eq("category", category);

  if (existingPool) {
    return { error: "A pool for this IPO and category already exists — join it from the list below instead." };
  }

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ?? user.email?.split("@")[0] ?? "user";
  const name = `${ipo.name}_${category}_${displayName}`;
  const inviteCode = randomBytes(4).toString("hex");

  const { data: pool, error } = await supabase
    .from("pools")
    .insert({ name, owner_id: user.id, invite_code: inviteCode, ipo_id: ipoId, category })
    .select("id")
    .single();

  if (error || !pool) {
    if (error?.message.toLowerCase().includes("duplicate")) {
      return { error: "A pool for this IPO and category already exists — join it from the list below instead." };
    }
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

  const panCardId = String(formData.get("panCardId") ?? "");
  const status = String(formData.get("status") ?? "applied");

  if (!panCardId) {
    return { error: "Choose a PAN card." };
  }

  const { count: ownsThisPan } = await supabase
    .from("pan_cards")
    .select("id", { count: "exact", head: true })
    .eq("id", panCardId)
    .eq("owner_id", user.id);

  if (!ownsThisPan) {
    return { error: "You can only log applications for your own PAN cards." };
  }

  const { count: alreadyApplied } = await supabase
    .from("pool_applications")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("pan_card_id", panCardId);

  if (alreadyApplied) {
    return { error: "This PAN has already applied in this pool — ask others to club onto it instead." };
  }

  const { data: pool } = await supabase.from("pools").select("ipo_id").eq("id", poolId).single();

  if (!pool) {
    return { error: "Pool not found." };
  }

  const { count: usedInOtherCategory } = await supabase
    .from("pool_applications")
    .select("id, pools!inner(ipo_id)", { count: "exact", head: true })
    .eq("pan_card_id", panCardId)
    .eq("pools.ipo_id", pool.ipo_id)
    .neq("pool_id", poolId);

  if (usedInOtherCategory) {
    return {
      error: "This PAN has already applied to this IPO in a different category — a PAN can only apply once per IPO.",
    };
  }

  const { error } = await supabase.from("pool_applications").insert({
    pool_id: poolId,
    pan_card_id: panCardId,
    status,
    created_by: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/pools/${poolId}`);
  return { error: null };
}

// A pool member without a spare PAN can club onto someone else's already-
// submitted application instead of being locked out. Blocked (via RLS) once
// the PAN's own allotment result is in, or for the PAN's own owner. A member
// can be actively clubbed into at most as many applications, in this pool,
// as they own PAN cards — otherwise one person with one PAN could club onto
// every application someone else split across their several PAN cards.
// Leave one (unclubFromApplication) to free up a slot for a different one.
export async function clubOnApplication(poolId: string, applicationId: string) {
  const { supabase, user } = await requireUser();

  const { count: myPanCardCount } = await supabase
    .from("pan_cards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);

  const { count: myActiveClubsInPool } = await supabase
    .from("pool_application_members")
    .select("application_id, pool_applications!inner(pool_id)", { count: "exact", head: true })
    .eq("profile_id", user.id)
    .eq("pool_applications.pool_id", poolId);

  if ((myActiveClubsInPool ?? 0) >= (myPanCardCount ?? 0)) {
    return {
      error: `You can only club into as many applications as you own PAN cards (${myPanCardCount ?? 0}) — remove an existing club-in first.`,
    };
  }

  const { error } = await supabase
    .from("pool_application_members")
    .insert({ application_id: applicationId, profile_id: user.id });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/pools/${poolId}`);
  return { error: null };
}

// Undo clubbing — always allowed, even after the allotment result is in.
export async function unclubFromApplication(poolId: string, applicationId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("pool_application_members")
    .delete()
    .eq("application_id", applicationId)
    .eq("profile_id", user.id);

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

// Used by the one-click "Join" button on the public pools list — no inline
// error UI there, so failures throw and surface via the default error
// boundary instead of returning a value (this is called directly as a
// plain <form action>, which requires a void-returning function).
export async function quickJoinPool(inviteCode: string) {
  const { supabase } = await requireUser();

  const { data: poolId, error } = await supabase.rpc("join_pool_by_invite_code", {
    code: inviteCode.trim().toLowerCase(),
  });

  if (error || !poolId) {
    throw new Error(error?.message ?? "Could not join pool.");
  }

  redirect(`/pools/${poolId}`);
}
