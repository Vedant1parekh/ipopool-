import { requireUser } from "@/lib/supabase/require-user";
import type { ApplicationMember } from "@/lib/types";
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

type PoolApplicationFinancialRow = {
  id: string;
  amount_deducted: number | null;
  amount_received: number | null;
  net_profit: number | null;
  payment_status: string;
  remarks: string | null;
  pools: { name: string; ipos: { name: string; listing_date: string | null; status: string } | null } | null;
  pan_cards: { owner_id: string; profiles: { display_name: string } | null } | null;
  pool_application_members: ApplicationMember[];
  last_modified_by: string | null;
};

export default async function ProfitLossPage() {
  const { supabase, user } = await requireUser();

  const { data: rows } = await supabase
    .from("pool_applications")
    .select(
      "id, amount_deducted, amount_received, net_profit, payment_status, remarks, last_modified_by, pools!inner(name, ipos!inner(name, listing_date, status)), pan_cards(owner_id, profiles(display_name)), pool_application_members(profile_id, profiles(display_name))",
    )
    .eq("allotment_status", "alloted")
    .in("pools.ipos.status", ["closed", "listed"])
    .order("created_at", { ascending: false })
    .returns<PoolApplicationFinancialRow[]>();

  const myRows = (rows ?? []).filter(
    (r) => r.pan_cards?.owner_id === user.id || r.pool_application_members.some((m) => m.profile_id === user.id),
  );

  const totalNet = myRows.reduce((sum, r) => {
    const memberCount = 1 + r.pool_application_members.length;
    return sum + (r.net_profit !== null ? Number(r.net_profit) / memberCount : 0);
  }, 0);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">My Profit &amp; Loss</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        One row per alloted application you&apos;re part of (as owner or clubbed member). Deducted/received amounts,
        payment status, and remarks are visible to everyone on the row, but only the applicant can edit and save
        them.
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
                <TableHead>Remarks</TableHead>
                <TableHead>Save</TableHead>
                <TableHead>Last modified by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {myRows.map((row) => {
                const coMemberNames = row.pool_application_members.map((m) => m.profiles?.display_name ?? "Member");
                const memberNames = [row.pan_cards?.profiles?.display_name ?? "Unknown", ...coMemberNames];
                const memberCount = memberNames.length;
                const isApplicant = row.pan_cards?.owner_id === user.id;

                return (
                  <TableRow key={row.id}>
                    <TableCell>{row.pan_cards?.profiles?.display_name ?? "—"}</TableCell>
                    <TableCell>{row.pools?.ipos?.name ?? "—"}</TableCell>
                    <TableCell>{row.pools?.ipos?.listing_date ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{memberNames.join(", ")}</TableCell>
                    <TableCell className="text-xs">
                      {coMemberNames.length === 0 ? (
                        <span className="text-muted-foreground">No clubbing — nothing to pay out</span>
                      ) : isApplicant ? (
                        <span className="font-medium text-warning-foreground">
                          You need to pay: {coMemberNames.join(", ")}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {row.pan_cards?.profiles?.display_name ?? "Applicant"} owes you a share
                        </span>
                      )}
                    </TableCell>
                    <PoolProfitRow
                      applicationId={row.id}
                      memberCount={memberCount}
                      editable={isApplicant}
                      initial={{
                        amountDeducted: row.amount_deducted,
                        amountReceived: row.amount_received,
                        paymentStatus: row.payment_status,
                        remarks: row.remarks,
                      }}
                    />
                    <TableCell className="text-xs text-muted-foreground">{row.last_modified_by ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
              {myRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={16} className="py-6 text-center text-muted-foreground">
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
