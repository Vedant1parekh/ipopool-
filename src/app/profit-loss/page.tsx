import { requireUser } from "@/lib/supabase/require-user";
import type { Ipo, PanCard, ProfitRecord } from "@/lib/types";
import { ProfitForm } from "./profit-form";
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

  // profile_id = auth.uid() is enforced by RLS on profit_records, so this
  // query can only ever return the logged-in user's own rows — no other
  // pool member's data can leak in here even if the query were broadened.
  const [{ data: records }, { data: ipos }, { data: panCards }] = await Promise.all([
    supabase
      .from("profit_records")
      .select("id, profile_id, pan_card_id, ipo_id, amount_deducted, amount_received, gross_profit, tax, net_profit, created_at, ipos(name)")
      .order("created_at", { ascending: false })
      .returns<ProfitRecord[]>(),
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

  const totalNet = records?.reduce((sum, r) => sum + Number(r.net_profit), 0) ?? 0;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-semibold">My Profit &amp; Loss</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        This is your own data only — other pool members&apos; entries never appear here.
      </p>

      <div className="mb-8">
        <ProfitForm ipos={ipos ?? []} panCards={panCards ?? []} />
      </div>

      <div className="mb-4 rounded-lg bg-muted p-4 text-sm">
        Total net profit:{" "}
        <span className={`font-semibold ${totalNet < 0 ? "text-destructive" : "text-success"}`}>
          ₹{totalNet.toFixed(2)}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IPO</TableHead>
                <TableHead>Deducted</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.ipos?.name ?? "—"}</TableCell>
                  <TableCell>₹{r.amount_deducted}</TableCell>
                  <TableCell>₹{r.amount_received}</TableCell>
                  <TableCell>₹{r.gross_profit}</TableCell>
                  <TableCell>₹{r.tax}</TableCell>
                  <TableCell
                    className={`font-medium ${Number(r.net_profit) < 0 ? "text-destructive" : "text-success"}`}
                  >
                    ₹{r.net_profit}
                  </TableCell>
                </TableRow>
              ))}
              {(!records || records.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No entries yet — log one above.
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
