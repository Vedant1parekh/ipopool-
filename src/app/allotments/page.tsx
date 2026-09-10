import { requireUser } from "@/lib/supabase/require-user";
import { type AllotmentRecord, type AllotmentRecordMember, type AllotmentStatus, type ApplicationMember, type Ipo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AllotmentChecklistItem } from "./allotment-row";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  allotment_status: AllotmentStatus;
  pools: { category: string; ipo_id: string } | null;
  pan_cards: {
    pan_number: string;
    label: string | null;
    profiles: { display_name: string } | null;
  } | null;
  pool_application_members: ApplicationMember[];
  last_modified_by: string | null;
};

// One shape for both sources: a live pool_applications row (editable, via
// the checklist) and a permanent allotment_records snapshot (read-only —
// see migration 0029). A record whose pool has since been deleted only
// exists in the second form, which is exactly the case this is for: it
// keeps showing up here instead of quietly disappearing.
type DisplayRow = {
  key: string;
  applicationId: string | null;
  applicantName: string;
  panLabel: string | null;
  panNumber: string;
  category: string;
  memberNames: string[];
  allotmentStatus: AllotmentStatus;
  lastModifiedBy: string | null;
};

export default async function AllotmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ipo?: string }>;
}) {
  const { supabase } = await requireUser();
  const { ipo: selectedIpoId } = await searchParams;

  const { data: ipos } = await supabase
    .from("ipos")
    .select("id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status")
    .in("status", ["closed", "listed"])
    .order("listing_date", { ascending: false })
    .returns<Ipo[]>();

  let displayRows: DisplayRow[] = [];
  if (selectedIpoId) {
    // my_pool_applications (unlike pool_applications directly) is
    // pre-restricted to rows the viewer is personally part of — as
    // applicant or as a clubbed-in member — not every pool-mate's
    // application, even within a shared pool.
    const [{ data: applications }, { data: records }] = await Promise.all([
      supabase
        .from("my_pool_applications")
        .select(
          "id, allotment_status, last_modified_by, pools!inner(category, ipo_id), pan_cards(pan_number, label, profiles(display_name)), pool_application_members(profile_id, profiles(display_name))",
        )
        .eq("pools.ipo_id", selectedIpoId)
        .order("created_at", { ascending: true })
        .returns<ApplicationRow[]>(),
      // Permanent snapshots for this IPO (RLS already restricts these to
      // ones the viewer is the applicant or a clubbed member of).
      supabase.from("allotment_records").select("*").eq("ipo_id", selectedIpoId).returns<AllotmentRecord[]>(),
    ]);

    const recordIds = (records ?? []).map((r) => r.id);
    const { data: recordMembers } = recordIds.length
      ? await supabase
          .from("allotment_record_members")
          .select("*")
          .in("allotment_record_id", recordIds)
          .returns<AllotmentRecordMember[]>()
      : { data: [] as AllotmentRecordMember[] };
    const membersByRecord = new Map<string, AllotmentRecordMember[]>();
    for (const m of recordMembers ?? []) {
      const list = membersByRecord.get(m.allotment_record_id) ?? [];
      list.push(m);
      membersByRecord.set(m.allotment_record_id, list);
    }

    const liveRows: DisplayRow[] = (applications ?? []).map((app) => ({
      key: app.id,
      applicationId: app.id,
      applicantName: app.pan_cards?.profiles?.display_name ?? "Unknown",
      panLabel: app.pan_cards?.label ?? null,
      panNumber: app.pan_cards?.pan_number ?? "—",
      category: app.pools?.category ?? "—",
      memberNames: app.pool_application_members.map((m) => m.profiles?.display_name ?? "Member"),
      allotmentStatus: app.allotment_status,
      lastModifiedBy: app.last_modified_by,
    }));
    const liveApplicationIds = new Set((applications ?? []).map((app) => app.id));

    // Only add a permanent record when no live row already covers it —
    // that's either because its pool was deleted (application_id is now
    // null) or, defensively, because the live query above missed it for
    // some other reason.
    const permanentOnlyRows: DisplayRow[] = (records ?? [])
      .filter((r) => !r.application_id || !liveApplicationIds.has(r.application_id))
      .map((r) => ({
        key: r.id,
        applicationId: null,
        applicantName: r.applicant_name,
        panLabel: r.pan_label,
        panNumber: r.pan_number,
        category: r.category,
        memberNames: (membersByRecord.get(r.id) ?? []).map((m) => m.member_name),
        allotmentStatus: "alloted" as AllotmentStatus,
        lastModifiedBy: r.last_modified_by,
      }));

    displayRows = [...liveRows, ...permanentOnlyRows];
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Allotment Results</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        See every PAN&apos;s allotment result across all pools you&apos;re a member of, for one IPO at a time.
      </p>

      <Card className="mb-8">
        <CardContent className="pt-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-48 flex-col gap-1 text-sm">
              IPO (allotment announced)
              <select
                name="ipo"
                defaultValue={selectedIpoId ?? ""}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>
                  Select an IPO
                </option>
                {ipos?.map((ipo) => (
                  <option key={ipo.id} value={ipo.id}>
                    {ipo.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              View
            </button>
          </form>
          {(!ipos || ipos.length === 0) && (
            <p className="mt-3 text-sm text-muted-foreground">
              No IPOs with an announced allotment yet (status must be Closed or Listed).
            </p>
          )}
        </CardContent>
      </Card>

      {selectedIpoId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Applications</CardTitle>
            {(() => {
              const selectedIpo = ipos?.find((ipo) => ipo.id === selectedIpoId);
              if (!selectedIpo) return null;
              // No reliable way to deep-link straight to the right registrar's
              // page per IPO (that needs a registrar id we don't have, and
              // isn't derivable from the IPO name) - a search link works for
              // every IPO without tracking which registrar handled it.
              const query = encodeURIComponent(`${selectedIpo.name} ipo allotment status`);
              return (
                <a
                  href={`https://www.google.com/search?q=${query}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary underline whitespace-nowrap"
                >
                  Check allotment status ↗
                </a>
              );
            })()}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>PAN Label</TableHead>
                  <TableHead>PAN Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allotment checklist</TableHead>
                  <TableHead>Last modified by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayRows.map((row) => {
                  const memberNames = [row.applicantName, ...row.memberNames];

                  return (
                    <TableRow key={row.key}>
                      <TableCell>{row.applicantName}</TableCell>
                      <TableCell>{row.panLabel ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{row.panNumber}</TableCell>
                      <TableCell className="uppercase text-muted-foreground">{row.category}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{memberNames.join(", ")}</TableCell>
                      <TableCell>
                        <AllotmentBadge status={row.allotmentStatus} />
                      </TableCell>
                      <TableCell>
                        {row.applicationId ? (
                          <AllotmentChecklistItem applicationId={row.applicationId} initialStatus={row.allotmentStatus} />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Permanent record — pool was removed, result kept forever.
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.lastModifiedBy ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {displayRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                      No applications logged for this IPO in any pool you&apos;re part of.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function AllotmentBadge({ status }: { status: AllotmentStatus }) {
  if (status === "alloted") {
    return <Badge className="bg-success text-success-foreground">Alloted</Badge>;
  }
  if (status === "not_alloted") {
    return <Badge variant="destructive">Not Alloted</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}
