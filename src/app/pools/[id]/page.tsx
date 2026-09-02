import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import type { ApplicationMember, PanCard } from "@/lib/types";
import { ApplicationForm, ClubButton } from "./application-form";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PoolRow = {
  id: string;
  name: string;
  invite_code: string;
  category: string;
  ipo_id: string;
  ipos: { name: string; type: string; status: string } | null;
};

type ApplicationRow = {
  id: string;
  status: string;
  allotment_status: string;
  pan_cards: {
    id: string;
    pan_number: string;
    label: string | null;
    owner_id: string;
    profiles: { display_name: string } | null;
  } | null;
  pool_application_members: ApplicationMember[];
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
    .select("id, name, invite_code, category, ipo_id, ipos(name, type, status)")
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
      .select(
        "id, status, allotment_status, pan_cards(id, pan_number, label, owner_id, profiles(display_name)), pool_application_members(profile_id, profiles(display_name))",
      )
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

  const usedPanIds = new Set((applications ?? []).map((a) => a.pan_cards?.id).filter(Boolean));

  const myPanCardIds = (myPanCards ?? []).map((p) => p.id);
  const { data: ipoWideUsage } = myPanCardIds.length
    ? await supabase
        .from("pool_applications")
        .select("pan_card_id, pools!inner(ipo_id)")
        .in("pan_card_id", myPanCardIds)
        .eq("pools.ipo_id", pool.ipo_id)
    : { data: [] as { pan_card_id: string }[] };
  const usedForThisIpoIds = new Set((ipoWideUsage ?? []).map((a) => a.pan_card_id));

  const availablePanCards = (myPanCards ?? []).filter(
    (p) => !usedPanIds.has(p.id) && !usedForThisIpoIds.has(p.id),
  );

  // A member can be clubbed into at most as many applications, in this pool,
  // as they own PAN cards.
  const myPanCardCount = (myPanCards ?? []).length;
  const myClubCountInPool = (applications ?? []).filter((a) =>
    a.pool_application_members.some((m) => m.profile_id === user.id),
  ).length;
  const reachedClubCap = myClubCountInPool >= myPanCardCount;

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
        <ApplicationForm poolId={id} panCards={availablePanCards} />
      </section>

      <section>
        <h2 className="mb-2 font-medium">Applications in this pool</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          No spare PAN? Club onto someone else&apos;s application instead of applying separately.
        </p>
        <div className="flex flex-col gap-2">
          {applications?.map((app) => {
            // Identify each participant by their PAN's label (falling back to the
            // PAN number, then their account name if they have no PAN on file) —
            // clearer for pool-mates than an account name, since one account can
            // hold several differently-labelled PAN cards (e.g. "Dad", "Mom").
            const memberIdentifiers = [
              app.pan_cards ? (app.pan_cards.label ?? app.pan_cards.pan_number) : "Unknown",
              ...app.pool_application_members.map((m) => {
                const cards = panCardsByMember.get(m.profile_id) ?? [];
                if (cards.length === 0) return m.profiles?.display_name ?? "Member";
                return cards.map((c) => c.label ?? c.pan_number).join("/");
              }),
            ];
            const isOwner = app.pan_cards?.owner_id === user.id;
            const isCoMember = app.pool_application_members.some((m) => m.profile_id === user.id);
            const canJoin = !isOwner && !isCoMember && app.allotment_status === "pending" && !reachedClubCap;
            const canLeave = !isOwner && isCoMember;
            const leaveDisabledReason =
              pool.ipos?.status === "closed"
                ? "Can't leave while the IPO is closed and awaiting allotment."
                : undefined;

            return (
              <div key={app.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-muted-foreground">
                    {app.pan_cards?.pan_number ?? "—"}
                    {app.pan_cards?.label && <span className="ml-2 font-sans">{app.pan_cards.label}</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {memberIdentifiers.join(", ")} · {memberIdentifiers.length} member
                    {memberIdentifiers.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={app.status === "applied" ? "default" : "secondary"}>{app.status}</Badge>
                  {(canJoin || canLeave) && (
                    <ClubButton
                      poolId={id}
                      applicationId={app.id}
                      isMember={isCoMember}
                      disabledReason={isCoMember ? leaveDisabledReason : undefined}
                    />
                  )}
                  {!isOwner && !isCoMember && reachedClubCap && app.allotment_status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      Clubbed into {myClubCountInPool}/{myPanCardCount} — your PAN card limit
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(!applications || applications.length === 0) && (
            <p className="text-sm text-muted-foreground">No applications logged yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
