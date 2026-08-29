import { requireUser } from "@/lib/supabase/require-user";
import type { Ipo, PanCard, ProfitRecord } from "@/lib/types";
import { ProfitForm } from "./profit-form";

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
      <p className="mb-6 text-sm text-gray-500">
        This is your own data only — other pool members&apos; entries never appear here.
      </p>

      <div className="mb-8">
        <ProfitForm ipos={ipos ?? []} panCards={panCards ?? []} />
      </div>

      <div className="mb-4 rounded-lg bg-gray-50 p-4 text-sm">
        Total net profit: <span className="font-semibold">₹{totalNet.toFixed(2)}</span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-3 py-2">IPO</th>
              <th className="px-3 py-2">Deducted</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Tax</th>
              <th className="px-3 py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {records?.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">{r.ipos?.name ?? "—"}</td>
                <td className="px-3 py-2">₹{r.amount_deducted}</td>
                <td className="px-3 py-2">₹{r.amount_received}</td>
                <td className="px-3 py-2">₹{r.gross_profit}</td>
                <td className="px-3 py-2">₹{r.tax}</td>
                <td className={`px-3 py-2 font-medium ${Number(r.net_profit) < 0 ? "text-red-600" : "text-green-600"}`}>
                  ₹{r.net_profit}
                </td>
              </tr>
            ))}
            {(!records || records.length === 0) && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                  No entries yet — log one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
