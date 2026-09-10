import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import { maskPan, type ApplicationMember, type PanCard } from "@/lib/types";
import { ApplicationForm, ClubButton, RemoveApplicationButton, RemovePoolButton } from "./application-form";
import { BackButton } from "@/components/back-button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { colorFromSeed } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PoolRow = {
  id: string;
  name: string;
  invite_code: string;
  category: string;
  ipo_id: string;
  ipos: { name: string; type: string; status: string; listing_date: string | null } | null;
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
    .select("id, name, invite_code, category, ipo_id, ipos(name, type, status, listing_date)")
    .eq("id", id)
    .maybeSingle<PoolRow>();

  if (!pool) {
    notFound();
  }

  const listingDate = pool.ipos?.listing_date;
  const removeEligibleFrom = listingDate ? new Date(listingDate) : null;
  removeEligibleFrom?.setUTCDate(removeEligibleFrom.getUTCDate() + 1);
  const removeDisabledReason = !listingDate
    ? "Can only be removed one day after the IPO's listing date."
    : new Date() < removeEligibleFrom!
      ? `Can be removed from ${removeEligibleFrom!.toLocaleDateString()}.`
      : undefined;

  const [{ data: members }, { data: applications }, { data: myPanCards }] = await Promise.all([
    supabase
      .from("pool_members")
      .select("profile_id, profiles(display_name)")
      .eq("pool_id", id)
      .returns<MemberRow[]>(),
    supabase
      .from("pool_applications")
      .select(
        "id, status, allotment_status, pan_cards(id, pan_number, label, owner_id, profiles(display_name)), pool_application_members(profile_id, pan_card_id, profiles(display_name), pan_cards(pan_number, label))",
      )
      .eq("pool_id", id)
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>(),
    supabase
      .from("pan_cards")
      .select("id, owner_id, pan_number, label, created_at")
      .eq("owner_id", user.id)
      .order("label", { ascending: true })
      .returns<PanCard[]>(),
  ]);

  const memberIds = (members ?? []).map((m) => m.profile_id);
  const { data: memberPanCards } = memberIds.length
    ? await supabase
        .from("pan_cards")
        .select("owner_id, pan_number, label")
        .in("owner_id", memberIds)
        .order("label", { ascending: true })
        .returns<MemberPanCard[]>()
    : { data: [] as MemberPanCard[] };

  const panCardsByMember = new Map<string, MemberPanCard[]>();
  for (const card of memberPanCards ?? []) {
    const list = panCardsByMember.get(card.owner_id) ?? [];
    list.push(card);
    panCardsByMember.set(card.owner_id, list);
  }

  const myPanCardIds = (myPanCards ?? []).map((p) => p.id);
  const { data: ipoWideUsage } = myPanCardIds.length
    ? await supabase
        .from("pool_applications")
        .select("pan_card_id, pools!inner(ipo_id)")
        .in("pan_card_id", myPanCardIds)
        .eq("pools.ipo_id", pool.ipo_id)
        .neq("pool_id", id)
    : { data: [] as { pan_card_id: string }[] };
  const usedForThisIpoIds = new Set((ipoWideUsage ?? []).map((a) => a.pan_card_id));

  // Every owned PAN stays selectable here, including one already logged in
  // this pool — re-selecting it updates that row (e.g. flipping applied/na),
  // handled in addApplication. Only cross-pool usage for the same IPO stays
  // excluded, since that's a hard one-PAN-per-IPO rule, not an editable row.
  const availablePanCards = (myPanCards ?? []).filter((p) => !usedForThisIpoIds.has(p.id));

  // Clubbing in should only spend a PAN card that's actually applied in this
  // pool (status "applied", not "na") — not any idle card the member
  // happens to own — since clubbing is for someone using an already-
  // committed PAN as their identity to back someone else's application.
  const myAppliedPanCardIds = new Set(
    (applications ?? [])
      .filter((a) => a.pan_cards?.owner_id === user.id && a.status === "applied")
      .map((a) => a.pan_cards!.id),
  );
  const myAppliedPanCards = (myPanCards ?? []).filter((p) => myAppliedPanCardIds.has(p.id));

  // A member can be clubbed into at most as many of one OWNER's applications
  // as they own PAN cards (a different card each time) — but gets a fresh
  // allowance against a different owner. So track which of my own cards
  // I've already used, grouped by the owner of the application I used them
  // on, and exclude only those from that owner's applications specifically.
  const usedCardsByOwner = new Map<string, Set<string>>();
  for (const app of applications ?? []) {
    const ownerId = app.pan_cards?.owner_id;
    if (!ownerId) continue;
    const myClub = app.pool_application_members.find((m) => m.profile_id === user.id);
    if (!myClub?.pan_card_id) continue;
    const used = usedCardsByOwner.get(ownerId) ?? new Set<string>();
    used.add(myClub.pan_card_id);
    usedCardsByOwner.set(ownerId, used);
  }

  // Removing an application would strand any club-in riding on it, so the
  // Remove button says so up front (in a dialog) instead of letting the
  // server reject the submit. Mirrors blockedFromUnapplying in the actions:
  // the other shape of the block is this PAN having clubbed onto someone
  // else's application in this pool, so map each clubbed-in card to the
  // application it went onto.
  const clubbedOntoByPanCard = new Map<string, string>();
  for (const app of applications ?? []) {
    const target = app.pan_cards
      ? `${app.pan_cards.profiles?.display_name ?? "another member"}'s application (${
          app.pan_cards.label ?? maskPan(app.pan_cards.pan_number)
        })`
      : "another application";
    for (const member of app.pool_application_members) {
      if (member.pan_card_id) clubbedOntoByPanCard.set(member.pan_card_id, target);
    }
  }

  // One table per applicant, instead of one long undifferentiated list —
  // easier to scan when someone has applied with several PAN cards.
  const applicationsByOwner = new Map<string, ApplicationRow[]>();
  for (const app of applications ?? []) {
    const ownerId = app.pan_cards?.owner_id ?? "unknown";
    const list = applicationsByOwner.get(ownerId) ?? [];
    list.push(app);
    applicationsByOwner.set(ownerId, list);
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <BackButton />
      <div className="flex items-start justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: colorFromSeed(pool.ipo_id) }} />
          {pool.name}
        </h1>
        {members?.some((m) => m.profile_id === user.id) && (
          <RemovePoolButton poolId={id} disabledReason={removeDisabledReason} />
        )}
      </div>
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
                    {maskPan(card.pan_number)}
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
        <div className="flex flex-col gap-4">
          {Array.from(applicationsByOwner.entries()).map(([ownerId, apps]) => {
            const ownerName = apps[0]?.pan_cards?.profiles?.display_name ?? "Unknown";
            return (
              <div key={ownerId} className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">
                  {ownerName} · {apps.length} application{apps.length === 1 ? "" : "s"}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PAN</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Clubbed with</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apps.map((app) => {
                      // Co-members only — the applicant is already the row itself.
                      const coMemberIdentifiers = app.pool_application_members.map((m) =>
                        m.pan_cards
                          ? (m.pan_cards.label ?? maskPan(m.pan_cards.pan_number))
                          : (m.profiles?.display_name ?? "Member"),
                      );
                      const isOwner = app.pan_cards?.owner_id === user.id;
                      const isCoMember = app.pool_application_members.some((m) => m.profile_id === user.id);
                      // Mirrors blockedFromUnapplying: removing would strand either a
                      // co-member clubbed onto this application, or this PAN's own
                      // club-in onto someone else's application in this pool.
                      const removeBlockedReason = app.pool_application_members.length > 0
                        ? "Other members are clubbed onto this application — remove their club-ins first."
                        : app.pan_cards && clubbedOntoByPanCard.has(app.pan_cards.id)
                          ? `This PAN is clubbed onto ${clubbedOntoByPanCard.get(app.pan_cards.id)} — remove that club-in first.`
                          : undefined;
                      const rowOwnerId = app.pan_cards?.owner_id;
                      const usedForThisOwner = rowOwnerId
                        ? (usedCardsByOwner.get(rowOwnerId) ?? new Set<string>())
                        : new Set<string>();
                      const availablePanCardsForRow = myAppliedPanCards.filter((p) => !usedForThisOwner.has(p.id));
                      const canJoin =
                        !isOwner &&
                        !isCoMember &&
                        app.status === "applied" &&
                        app.allotment_status === "pending" &&
                        availablePanCardsForRow.length > 0;
                      const canLeave = !isOwner && isCoMember;
                      const leaveDisabledReason =
                        pool.ipos?.status === "closed"
                          ? "Can't leave while the IPO is closed and awaiting allotment."
                          : undefined;

                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <span className="font-mono">
                              {app.pan_cards ? maskPan(app.pan_cards.pan_number) : "—"}
                            </span>
                            {app.pan_cards?.label && (
                              <span className="ml-2 text-xs text-muted-foreground">{app.pan_cards.label}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={app.status === "applied" ? "default" : "secondary"}>{app.status}</Badge>
                          </TableCell>
                          <TableCell className="whitespace-normal text-xs text-muted-foreground">
                            {coMemberIdentifiers.length > 0 ? coMemberIdentifiers.join(", ") : "—"}
                          </TableCell>
                          <TableCell>
                            {isOwner && (
                              <RemoveApplicationButton
                                poolId={id}
                                applicationId={app.id}
                                blockedReason={removeBlockedReason}
                              />
                            )}
                            {(canJoin || canLeave) && (
                              <ClubButton
                                poolId={id}
                                applicationId={app.id}
                                isMember={isCoMember}
                                disabledReason={isCoMember ? leaveDisabledReason : undefined}
                                panCards={availablePanCardsForRow}
                              />
                            )}
                            {!isOwner &&
                              !isCoMember &&
                              app.status === "applied" &&
                              app.allotment_status === "pending" &&
                              availablePanCardsForRow.length === 0 && (
                                <span className="text-xs text-muted-foreground">No PAN cards left</span>
                              )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
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
