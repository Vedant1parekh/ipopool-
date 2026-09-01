import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import type { IpoStatus, IpoType } from "@/lib/types";
import { getSyncStateSummary, syncOpenIposIfNeeded, TEST_SYNC_EMAIL } from "@/lib/ipo-sync";
import { SyncStatusBanner } from "./sync-status-banner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type DashboardIpo = {
  id: string;
  name: string;
  type: IpoType;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  price_band_min: number | null;
  price_band_max: number | null;
  lot_size: number | null;
  status: IpoStatus;
  logo_url: string | null;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const { type } = await searchParams;
  const activeType: IpoType = type === "sme" ? "sme" : "mainboard";

  const { data: ipos, error } = await supabase
    .from("ipos")
    .select(
      "id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status, logo_url",
    )
    .eq("type", activeType)
    .order("open_date", { ascending: true })
    .returns<DashboardIpo[]>();

  // TEMPORARY test UI — remove once manual testing of the sync is done.
  // Reflects live state on every visit to this page (not just right after
  // login), so switching tabs and coming back still shows the current
  // cooldown/done status instead of only working immediately post-login.
  const showSyncBanner = user.email?.toLowerCase() === TEST_SYNC_EMAIL;
  let syncMessage: string | null = null;
  if (showSyncBanner) {
    const result = await syncOpenIposIfNeeded();
    if (!result.skipped) {
      syncMessage = "error" in result
        ? `Error: ${result.error}`
        : `Fetched ${result.pagesFetched} page(s), synced ${result.synced} IPO(s).`;
    }
  }
  const syncState = showSyncBanner ? await getSyncStateSummary() : null;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">IPO Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
        <Button size="sm" render={<Link href="/pools">Join / manage pools</Link>} />
      </div>

      {showSyncBanner && syncState && (
        <SyncStatusBanner
          lastBatchAt={syncState.lastBatchAt}
          initialDone={syncState.done}
          initialMessage={syncMessage}
        />
      )}

      <div className="mb-6 inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-[3px]">
        <TabLink label="Mainboard" type="mainboard" active={activeType === "mainboard"} />
        <TabLink label="SME" type="sme" active={activeType === "sme"} />
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load IPOs: {error.message}</p>}

      {!error && (!ipos || ipos.length === 0) && (
        <p className="text-sm text-muted-foreground">No {activeType.toUpperCase()} IPOs to show yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {ipos?.map((ipo) => (
          <Link key={ipo.id} href={`/dashboard/${ipo.id}`}>
            <Card className="p-4 transition-colors hover:bg-muted/50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {ipo.logo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={ipo.logo_url}
                      alt=""
                      className="size-8 shrink-0 rounded-md border object-contain"
                    />
                  )}
                  <h2 className="truncate font-medium">{ipo.name}</h2>
                </div>
                <StatusBadge status={ipo.status} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-4">
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
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}

function TabLink({ label, type, active }: { label: string; type: string; active: boolean }) {
  return (
    <Link
      href={`/dashboard?type=${type}`}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

function StatusBadge({ status }: { status: IpoStatus }) {
  const variants: Record<IpoStatus, string> = {
    open: "bg-primary text-primary-foreground",
    upcoming: "bg-secondary text-secondary-foreground",
    closed: "bg-warning text-warning-foreground",
    listed: "bg-success text-success-foreground",
  };
  return <Badge className={`uppercase ${variants[status]}`}>{status}</Badge>;
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
