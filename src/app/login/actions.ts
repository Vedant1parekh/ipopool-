"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { syncOpenIposIfNeeded, TEST_SYNC_EMAIL } from "@/lib/ipo-sync";

// TEMPORARY test hook — remove once manual testing of the sync is done.
// Fires one batch (up to 6 pages) only for this specific account, so it
// doesn't reintroduce the general "every login triggers a sync" behavior
// that was deliberately removed in favor of cron being the sole trigger.
// Awaited (not after()) so we know whether THIS login actually triggered a
// batch — if cron already covered today before this login, the claim is
// skipped and no dialog signal is passed, so the dashboard stays quiet.

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  if (email.toLowerCase() === TEST_SYNC_EMAIL) {
    const result = await syncOpenIposIfNeeded();
    if (!result.skipped) {
      redirect("/dashboard?syncTriggered=1");
    }
  }

  redirect("/dashboard");
}
