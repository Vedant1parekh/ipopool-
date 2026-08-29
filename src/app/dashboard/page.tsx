import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import type { Ipo, IpoType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase } = await requireUser();
  const { type } = await searchParams;
  const activeType: IpoType = type === "sme" ? "sme" : "mainboard";

  const { data: ipos, error } = await supabase
    .from("ipos")
    .select("id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status")
    .eq("type", activeType)
    .order("open_date", { ascending: false })
    .returns<Ipo[]>();

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">IPO Dashboard</h1>
        <Link href="/pools" className="rounded-md bg-black px-4 py-2 text-sm text-white">
          Join / manage pools
        </Link>
      </div>

      <div className="mb-6 flex gap-2 border-b">
        <TabLink label="Mainboard" type="mainboard" active={activeType === "mainboard"} />
        <TabLink label="SME" type="sme" active={activeType === "sme"} />
      </div>

      {error && <p className="text-sm text-red-600">Couldn&apos;t load IPOs: {error.message}</p>}

      {!error && (!ipos || ipos.length === 0) && (
        <p className="text-sm text-gray-500">No {activeType.toUpperCase()} IPOs to show yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {ipos?.map((ipo) => (
          <li key={ipo.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{ipo.name}</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs uppercase text-gray-600">
                {ipo.status}
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-gray-600 sm:grid-cols-4">
              <Info label="Open" value={ipo.open_date} />
              <Info label="Close" value={ipo.close_date} />
              <Info label="Listing" value={ipo.listing_date} />
              <Info
                label="Price band"
                value={
                  ipo.price_band_min && ipo.price_band_max
                    ? `₹${ipo.price_band_min}–${ipo.price_band_max}`
                    : null
                }
              />
              <Info label="Lot size" value={ipo.lot_size} />
            </dl>
          </li>
        ))}
      </ul>
    </main>
  );
}

function TabLink({ label, type, active }: { label: string; type: string; active: boolean }) {
  return (
    <Link
      href={`/dashboard?type=${type}`}
      className={`-mb-px border-b-2 px-3 py-2 text-sm ${
        active ? "border-black font-medium" : "border-transparent text-gray-500"
      }`}
    >
      {label}
    </Link>
  );
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-gray-400">{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}
