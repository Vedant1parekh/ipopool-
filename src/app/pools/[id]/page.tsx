import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import type { PanCard } from "@/lib/types";
import { ApplicationForm } from "./application-form";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PoolRow = {
  id: string;
  name: string;
  invite_code: string;
  category: string;
  ipos: { name: string; type: string } | null;
};

type ApplicationRow = {
  id: string;
  status: string;
  pan_cards: { pan_number: string; label: string | null; owner_id: string } | null;
};

type MemberRow = {
  profile_id: string;
  profiles: { display_name: string } | null;
};

type MemberPanCard = { owner_id: string; pan_number: string; label: string | null };

export default async function PoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();

  const { data: pool } = await supabase
    .from("pools")
    .select("id, name, invite_code, category, ipos(name, type)")
    .eq("id", id)
    .maybeSingle<PoolRow>();

  if (!pool) {
    notFound();
  }

  const [{ data: members }, { data: applications }, { data: myPanCards }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("profile_id, profiles(display_name)")
      .eq("pool_id", id)
      .returns<MemberRow[]>(),
    supabase
      .from("pool_applications")
      .select("id, status, pan_cards(pan_number, label, owner_id)")
      .eq("pool_id", id)
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>(),
    supabase
      .from("pan_cards")
      .select("id, owner_id, pan_number, label, created_at")
      .eq("owner_id", user.id)
      .returns<PanCard[]>(),
  ]);

  const memberIds = (members ?? []).map((m) => m.profile_id);
  const { data: memberPanCards } = memberIds.length
    ? await supabase
        .from("pan_cards")
        .select("owner_id, pan_number, label")
        .in("owner_id", memberIds)
        .returns<MemberPanCard[]>()
    : { data: [] as MemberPanCard[] };

  const panCardsByMember = new Map<string, MemberPanCard[]>();
  for (const card of memberPanCards ?? []) {
    const list = panCardsByMember.get(card.owner_id) ?? [];
    list.push(card);
    panCardsByMember.set(card.owner_id, list);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">{pool.name}</h1>
      <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
        <span>{pool.ipos?.name ?? "Unknown IPO"}</span>
        <span>·</span>
        <span className="capitalize">{pool.ipos?.type}</span>
        <span>·</span>
        <Badge variant="secondary" className="uppercase">
          {pool.category}
        </Badge>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Invite code: <span className="font-mono">{pool.invite_code}</span> — anyone can find this pool from the
        pools list, or join directly with this code.
      </p>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Members ({members?.length ?? 0})</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          PAN numbers are visible to fellow members only, so you can verify who&apos;s actually applying.
        </p>
        <div className="flex flex-col gap-2">
          {members?.map((m) => (
            <div key={m.profile_id} className="rounded-lg border p-3 text-sm">
              <div className="mb-1 font-medium">{m.profiles?.display_name ?? "Member"}</div>
              <div className="flex flex-wrap gap-2">
                {(panCardsByMember.get(m.profile_id) ?? []).map((card) => (
                  <span key={card.pan_number} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs">
                    {card.pan_number}
                    {card.label && <span className="ml-1 text-muted-foreground">({card.label})</span>}
                  </span>
                ))}
                {(panCardsByMember.get(m.profile_id) ?? []).length === 0 && (
                  <span className="text-xs text-muted-foreground">No PAN cards on file</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <ApplicationForm poolId={id} panCards={myPanCards ?? []} />
      </section>

      <section>
        <h2 className="mb-2 font-medium">Applications in this pool</h2>
        <div className="flex flex-col gap-2">
          {applications?.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between rounded-lg border p-3 text-sm"
            >
              <span className="font-mono text-muted-foreground">
                {app.pan_cards?.pan_number ?? "—"}
                {app.pan_cards?.label && <span className="ml-2 font-sans">{app.pan_cards.label}</span>}
              </span>
              <Badge variant={app.status === "applied" ? "default" : "secondary"}>{app.status}</Badge>
            </div>
          ))}
          {(!applications || applications.length === 0) && (
            <p className="text-sm text-muted-foreground">No applications logged yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
