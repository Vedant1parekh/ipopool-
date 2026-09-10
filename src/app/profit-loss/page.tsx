import { requireUser } from "@/lib/supabase/require-user";
import type { AllotmentRecord, AllotmentRecordMember } from "@/lib/types";
import { PoolProfitRow } from "./pool-profit-row";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function ProfitLossPage() {
  const { supabase, user } = await requireUser();

  // Reads the permanent snapshot (see migration 0029) instead of
  // pool_applications directly — RLS already restricts rows to ones the
  // viewer is the applicant or a clubbed member of, and unlike the live
  // table this doesn't disappear once the pool that produced it is
  // removed: an alloted result is a fact of record, kept forever.
  const { data: records } = await supabase
    .from("allotment_records")
    .select("*")
    .order("alloted_at", { ascending: false })
    .returns<AllotmentRecord[]>();

  const myRecords = records ?? [];
  const recordIds = myRecords.map((r) => r.id);
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

  const totalNet = myRecords.reduce((sum, r) => {
    const memberCount = 1 + (membersByRecord.get(r.id)?.length ?? 0);
    return sum + (r.net_profit !== null ? Number(r.net_profit) / memberCount : 0);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">My Profit &amp; Loss</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        One row per alloted application you&apos;re part of (as owner or clubbed member) — kept here permanently,
        even after the pool it came from is removed. Deducted/received amounts and payment status are visible to
        everyone on the row, but only the applicant can edit and save them, and only while the pool it came from
        still exists.
      </p>

      <div className="mb-4 rounded-lg bg-muted p-4 text-sm">
        Your total net profit (after clubbing split):{" "}
        <span className={`font-semibold ${totalNet < 0 ? "text-destructive" : "text-success"}`}>
          ₹{totalNet.toFixed(2)}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Applicant</TableHead>
                <TableHead>IPO</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Payout reminder</TableHead>
                <TableHead>Deducted</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Split</TableHead>
                <TableHead>Per person</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Save</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRecords.map((row) => {
                const coMemberNames = (membersByRecord.get(row.id) ?? []).map((m) => m.member_name);
                const memberNames = [row.applicant_name, ...coMemberNames];
                const memberCount = memberNames.length;
                const isApplicant = row.applicant_profile_id === user.id;
                // Editing writes back to the live pool_applications row —
                // once the pool is gone (application_id null'd out by
                // migration 0029's soft link), this becomes a read-only
                // historical record.
                const editable = isApplicant && row.application_id !== null;

                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.applicant_name}</TableCell>
                    <TableCell>{row.ipo_name}</TableCell>
                    <TableCell>{row.listing_date ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{memberNames.join(", ")}</TableCell>
                    <TableCell className="text-xs">
                      {coMemberNames.length === 0 ? (
                        <span className="text-muted-foreground">No clubbing — nothing to pay out</span>
                      ) : isApplicant ? (
                        <span className="font-medium text-warning-foreground">
                          You need to pay: {coMemberNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{row.applicant_name} owes you a share</span>
                      )}
                    </TableCell>
                    <PoolProfitRow
                      applicationId={row.application_id}
                      memberCount={memberCount}
                      editable={editable}
                      initial={{
                        amountDeducted: row.amount_deducted,
                        amountReceived: row.amount_received,
                        paymentStatus: row.payment_status,
                        remarks: row.remarks,
                      }}
                    />
                  </TableRow>
                );
              })}
              {myRecords.length === 0 && (
                <TableRow>
                  <TableCell colSpan={14} className="py-6 text-center text-muted-foreground">
                    No alloted applications yet — this fills in once an application you&apos;re part of is marked
                    Alloted on the Allotments page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  );
}
