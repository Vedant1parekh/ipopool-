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

// Any member of the pool can remove it, but only once a day has passed
// since the IPO listed — before that, members are still relying on it.
// RLS (0025) enforces both conditions independently; these checks just
// produce a friendly message instead of a silent no-op delete.
export async function removePool(poolId: string) {
  const { supabase, user } = await requireUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("ipos(listing_date)")
    .eq("id", poolId)
    .single<{ ipos: { listing_date: string | null } | null }>();

  if (!pool) {
    return { error: "Pool not found." };
  }

  const { count: isMember } = await supabase
    .from("pool_members")
    .select("id", { count: "exact", head: true })
    .eq("pool_id", poolId)
    .eq("profile_id", user.id);

  if (!isMember) {
    return { error: "Only members of this pool can remove it." };
  }

  const listingDate = pool.ipos?.listing_date;

  if (!listingDate) {
    return { error: "This pool can only be removed one day after the IPO's listing date." };
  }

  const eligibleFrom = new Date(listingDate);
  eligibleFrom.setUTCDate(eligibleFrom.getUTCDate() + 1);

  if (new Date() < eligibleFrom) {
    return { error: "This pool can only be removed starting one day after the IPO's listing date." };
  }

  const { error } = await supabase.from("pools").delete().eq("id", poolId);

  if (error) {
    return { error: error.message };
  }

  redirect("/pools");
}

// Shared guard for anything that stops an application being "applied" —
// flipping it to na, or removing it outright. Both would silently strand
// a club-in: one on this application (someone clubbed onto it), or one
// this PAN itself made onto someone else's application (which requires
// status "applied" to have been eligible in the first place).
async function blockedFromUnapplying(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  poolId: string,
  applicationId: string,
  panCardId: string,
) {
  const { count: hasClubMembers } = await supabase
    .from("pool_application_members")
    .select("profile_id", { count: "exact", head: true })
    .eq("application_id", applicationId);

  if (hasClubMembers) {
    return "Other members are clubbed onto this application — remove their club-ins first.";
  }

  const { count: usedToClubElsewhere } = await supabase
    .from("pool_application_members")
    .select("application_id, pool_applications!inner(pool_id)", { count: "exact", head: true })
    .eq("pan_card_id", panCardId)
    .eq("pool_applications.pool_id", poolId);

  if (usedToClubElsewhere) {
    return "This PAN has already clubbed onto another application in this pool — remove that club-in first.";
  }

  return null;
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

  // Re-selecting a PAN that already has a row in this pool updates that row
  // instead of blocking or creating a duplicate — including flipping an
  // "applied" row back to "na" (e.g. correcting a mistaken entry). The one
  // guard: don't allow that flip while other members are clubbed onto it,
  // since that would silently strand their club-in on a non-application.
  const { data: existing } = await supabase
    .from("pool_applications")
    .select("id, status")
    .eq("pool_id", poolId)
    .eq("pan_card_id", panCardId)
    .maybeSingle();

  if (existing && status !== "applied") {
    const blockedReason = await blockedFromUnapplying(supabase, poolId, existing.id, panCardId);
    if (blockedReason) {
      return { error: blockedReason };
    }
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

  const { error } = existing
    ? await supabase.from("pool_applications").update({ status }).eq("id", existing.id)
    : await supabase.from("pool_applications").insert({
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

// Deletes the application outright, unlike marking it "na" — that still
// leaves the row in place, which still blocks this PAN from applying under
// a different category of the same IPO (the cross-category check looks at
// row existence, not status). A genuine mistake needs a genuine delete.
export async function removeApplication(poolId: string, applicationId: string) {
  const { supabase, user } = await requireUser();

  const { data: application } = await supabase
    .from("pool_applications")
    .select("id, pan_card_id, pan_cards!inner(owner_id)")
    .eq("id", applicationId)
    .eq("pool_id", poolId)
    .single<{ id: string; pan_card_id: string; pan_cards: { owner_id: string } | null }>();

  if (!application || application.pan_cards?.owner_id !== user.id) {
    return { error: "Only the applicant can remove this application." };
  }

  const blockedReason = await blockedFromUnapplying(supabase, poolId, applicationId, application.pan_card_id);
  if (blockedReason) {
    return { error: blockedReason };
  }

  const { error } = await supabase.from("pool_applications").delete().eq("id", applicationId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/pools/${poolId}`);
  return { error: null };
}

// A pool member without a spare PAN can club onto someone else's already-
// submitted application instead of being locked out. Blocked (via RLS) once
// the PAN's own allotment result is in, or for the PAN's own owner. Clubbing
// is tied to one of the clubbing member's own PAN cards. The cap is per
// application OWNER, not pool-wide: a member can be clubbed into at most as
// many of one owner's applications as they own PAN cards (a different card
// each time), but gets a fresh allowance against a different owner — so the
// same card can back applications from several different owners, just never
// two applications from the SAME owner.
//
// This also automatically clubs the other way: the target owner's own
// applied PAN gets clubbed onto the caller's application that uses the
// same PAN the caller just clubbed in with, so the owner doesn't have to
// manually redo the same action back. All validation for both directions
// happens inside club_in_with_reciprocal (SECURITY DEFINER — a plain
// client insert can't write a row with someone else's profile_id).
export async function clubOnApplication(poolId: string, applicationId: string, panCardId: string) {
  const { supabase } = await requireUser();

  if (!panCardId) {
    return { error: "Choose a PAN card to club in with." };
  }

  const { error } = await supabase.rpc("club_in_with_reciprocal", {
    p_application_id: applicationId,
    p_pan_card_id: panCardId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/pools/${poolId}`);
  return { error: null };
}

// Undo clubbing — blocked while the IPO is closed and awaiting allotment,
// same as the leave button's own disabled state. Also removes the
// reciprocal club-in created by club_in_with_reciprocal, if any — a plain
// delete of just the caller's own row would leave that side orphaned,
// since removing someone else's row needs to bypass "auth.uid() =
// profile_id" (see unclub_with_reciprocal, SECURITY DEFINER).
export async function unclubFromApplication(poolId: string, applicationId: string) {
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("unclub_with_reciprocal", { p_application_id: applicationId });

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
