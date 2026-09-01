"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncOpenIposIfNeeded } from "@/lib/ipo-sync";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  // First login of the day triggers the IPO sync; the atomic claim inside
  // means every other login that day is a cheap no-op. Runs after the
  // redirect response is sent, so it never slows down this user's login.
  after(() => syncOpenIposIfNeeded());

  redirect("/dashboard");
}
