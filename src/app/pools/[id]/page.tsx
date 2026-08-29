import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { maskPan, type Ipo, type PanCard } from "@/lib/types";
import { ApplicationForm } from "./application-form";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  category: string;
  status: string;
  ipos: { name: string } | null;
  pan_cards: { pan_number: string; label: string | null; owner_id: string } | null;
};

type MemberRow = {
  profile_id: string;
  profiles: { display_name: string } | null;
};

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name, invite_code")
    .eq("id", id)
    .maybeSingle();

  if (!pool) {
    notFound();
  }

  const [{ data: members }, { data: applications }, { data: ipos }, { data: panCards }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("profile_id, profiles(display_name)")
      .eq("pool_id", id)
      .returns<MemberRow[]>(),
    supabase
      .from("pool_applications")
      .select("id, category, status, ipos(name), pan_cards(pan_number, label, owner_id)")
      .eq("pool_id", id)
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>(),
    supabase
      .from("ipos")
      .select("id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status")
      .order("open_date", { ascending: false })
      .returns<Ipo[]>(),
    supabase
      .from("pan_cards")
      .select("id, owner_id, pan_number, label, created_at")
      .eq("owner_id", user.id)
      .returns<PanCard[]>(),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">{pool.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        Invite code: <span className="font-mono">{pool.invite_code}</span> — share this with people you trust.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Members ({members?.length ?? 0})</h2>
        <ul className="flex flex-wrap gap-2 text-sm">
          {members?.map((m) => (
            <li key={m.profile_id} className="rounded-full bg-gray-100 px-3 py-1">
              {m.profiles?.display_name ?? "Member"}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-8">
        <ApplicationForm poolId={id} ipos={ipos ?? []} panCards={panCards ?? []} />
      </section>

      <section>
        <h2 className="mb-2 font-medium">Applications in this pool</h2>
        <ul className="flex flex-col gap-2">
          {applications?.map((app) => (
            <li key={app.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
              <span>{app.ipos?.name ?? "Unknown IPO"}</span>
              <span className="text-gray-500">
                {app.pan_cards?.label ?? maskPan(app.pan_cards?.pan_number ?? "")}
              </span>
              <span className="uppercase text-gray-400">{app.category}</span>
              <span className={app.status === "applied" ? "text-green-600" : "text-gray-400"}>
                {app.status}
              </span>
            </li>
          ))}
          {(!applications || applications.length === 0) && (
            <p className="text-sm text-gray-500">No applications logged yet.</p>
          )}
        </ul>
      </section>
    </main>
  );
}
