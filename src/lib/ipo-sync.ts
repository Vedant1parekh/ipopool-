import { createClient } from "@supabase/supabase-js";
import type { IpoStatus, IpoType } from "@/lib/types";

// Called by the Vercel Cron route only (see src/app/api/cron/sync-ipos) —
// on the Hobby plan cron fires once daily, so this runs once a day.
// Provider: ipoalerts.in — free tier: 6 req/min, 25/day, 750/month.
// Confirmed against a real key: `status` is required and only
// "open"/"upcoming" are allowed on this plan ("closed"/"listed" error with
// "This parameter is not supported for free plan users"); `limit` isn't a
// valid param either — the API always returns exactly 1 IPO per page; and
// firing more than 6 requests within a minute gets a 429 (confirmed: pages
// 1-6 succeeded, page 7 failed).
//
// Sleeping between requests to stay under 6/min would make this run for
// minutes, risking a serverless function timeout — so instead each
// invocation fetches only one batch of BATCH_SIZE pages and saves a resume
// cursor (`next_page`/`total_pages` on ipo_sync_state); the next cron run
// picks up where it left off, until the day's full page count is covered
// (which may take several days if there are many open IPOs, since cron
// only fires once a day on this plan).

const BATCH_SIZE = 6;
const BATCH_COOLDOWN_MS = 65_000; // stay clear of the 6/min window resetting
export const SYNC_BATCH_COOLDOWN_SECONDS = Math.floor(BATCH_COOLDOWN_MS / 1000);
const DAILY_REQUEST_CAP = 25; // matches claim_ipo_sync_batch's daily_request_cap

// TEMPORARY test hook target (see src/app/login/actions.ts and
// src/app/dashboard/page.tsx) — remove once manual testing is done.
export const TEST_SYNC_EMAIL = "vedantkparekh@gmail.com";

type IpoAlertsRecord = {
  name: string;
  type: string; // "EQ" (mainboard) | "SME" | "DEBT"
  status: string; // open | closed | upcoming | listed | announced
  startDate: string | null;
  endDate: string | null;
  listingDate: string | null;
  priceRange: string | null; // e.g. "95-100"
  minQty: number | string | null;
  symbol: string | null;
  slug: string | null;
  logo: string | null;
  about: string | null;
  strengths: string[] | null;
  risks: string[] | null;
  schedule: { event: string; date: string }[] | null;
  issueSize: string | null;
  minAmount: number | string | null;
  prospectusUrl: string | null;
  nseInfoUrl: string | null;
  bseInfoUrl: string | null;
  typeOfIssue: string | null;
};

type IpoAlertsResponse = {
  meta: { totalPages: number; page: number };
  ipos: IpoAlertsRecord[];
};

type MappedIpo = {
  name: string;
  type: IpoType;
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  price_band_min: number | null;
  price_band_max: number | null;
  lot_size: number | null;
  status: IpoStatus;
  source: string;
  symbol: string | null;
  slug: string | null;
  logo_url: string | null;
  about: string | null;
  strengths: string[] | null;
  risks: string[] | null;
  schedule: { event: string; date: string }[] | null;
  issue_size: string | null;
  min_amount: number | null;
  prospectus_url: string | null;
  nse_info_url: string | null;
  bse_info_url: string | null;
  type_of_issue: string | null;
};

function parsePriceRange(range: string | null): [number | null, number | null] {
  if (!range) return [null, null];
  const parts = range.split("-").map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return [parts[0], parts[1]];
  }
  const single = Number(range.trim());
  return Number.isNaN(single) ? [null, null] : [single, single];
}

function normalizeType(type: string): IpoType | null {
  const t = type.toLowerCase();
  if (t === "sme") return "sme";
  if (t === "eq") return "mainboard";
  return null; // e.g. "DEBT" — not something we track
}

function normalizeStatus(status: string): IpoStatus {
  const s = status.toLowerCase();
  if (s === "open" || s === "closed" || s === "listed") return s;
  return "upcoming"; // covers "upcoming" and "announced"
}

function mapRecord(record: IpoAlertsRecord): MappedIpo | null {
  const type = normalizeType(record.type);
  if (!type) return null;

  const [price_band_min, price_band_max] = parsePriceRange(record.priceRange);
  return {
    name: record.name,
    type,
    open_date: record.startDate,
    close_date: record.endDate,
    listing_date: record.listingDate,
    price_band_min,
    price_band_max,
    lot_size: record.minQty ? Number(record.minQty) : null,
    status: normalizeStatus(record.status),
    source: "ipoalerts",
    symbol: record.symbol,
    slug: record.slug,
    logo_url: record.logo,
    about: record.about,
    strengths: record.strengths,
    risks: record.risks,
    schedule: record.schedule,
    issue_size: record.issueSize,
    min_amount: record.minAmount ? Number(record.minAmount) : null,
    prospectus_url: record.prospectusUrl,
    nse_info_url: record.nseInfoUrl,
    bse_info_url: record.bseInfoUrl,
    type_of_issue: record.typeOfIssue,
  };
}

export type SyncResult =
  | { skipped: true }
  | {
      skipped: false;
      synced: number;
      pagesFetched: number;
      totalPages: number | null;
      done: boolean;
      hitRateLimit: boolean;
    }
  | { skipped: false; error: string };

// Resumable across invocations: claim_ipo_sync_batch() atomically decides
// whether this invocation should run (row-locked in Postgres — cheap
// insurance against overlapping cron runs, e.g. a retry), then this
// fetches at most one batch and saves the new cursor.
export async function syncOpenIposIfNeeded(): Promise<SyncResult> {
  if (!process.env.IPO_DATA_API_KEY) {
    return { skipped: false, error: "IPO_DATA_API_KEY is not set." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: claim, error: claimError } = await supabase
    .rpc("claim_ipo_sync_batch", { cooldown_seconds: Math.floor(BATCH_COOLDOWN_MS / 1000) })
    .returns<{ should_run: boolean; start_page: number; known_total_pages: number | null }[]>()
    .single();

  if (claimError || !claim) {
    return { skipped: false, error: claimError?.message ?? "claim_ipo_sync_batch returned nothing." };
  }

  if (!claim.should_run) {
    return { skipped: true };
  }

  let nextPage = claim.start_page;
  let totalPages: number | null = claim.known_total_pages;

  const byKey = new Map<string, MappedIpo>();
  let pagesFetched = 0;
  let hitRateLimit = false;

  while (
    pagesFetched < BATCH_SIZE &&
    (totalPages === null || nextPage <= totalPages) &&
    nextPage <= DAILY_REQUEST_CAP
  ) {
    const providerResponse = await fetch(`https://api.ipoalerts.in/ipos?status=open&page=${nextPage}`, {
      headers: { "x-api-key": process.env.IPO_DATA_API_KEY },
    });

    if (providerResponse.status === 429) {
      hitRateLimit = true;
      break;
    }

    if (!providerResponse.ok) {
      return { skipped: false, error: `ipoalerts.in request failed on page ${nextPage}: ${providerResponse.status}` };
    }

    const payload = (await providerResponse.json()) as IpoAlertsResponse;
    totalPages = payload.meta?.totalPages ?? 1;

    for (const record of payload.ipos ?? []) {
      const mapped = mapRecord(record);
      if (mapped) byKey.set(`${mapped.name}|${mapped.type}`, mapped);
    }

    nextPage += 1;
    pagesFetched += 1;
  }

  const mapped = Array.from(byKey.values());
  let synced = 0;

  if (mapped.length > 0) {
    const { error, count } = await supabase
      .from("ipos")
      .upsert(
        mapped.map((ipo) => ({ ...ipo, last_synced_at: new Date().toISOString() })),
        { onConflict: "name,type", count: "exact" },
      );

    if (error) {
      return { skipped: false, error: error.message };
    }

    synced = count ?? mapped.length;
  }

  // ipoalerts.in never gives us status=closed on this plan, so derive it
  // ourselves: any IPO still marked "open" whose close date has already
  // passed (i.e. today is after it) is actually closed by now.
  await supabase.from("ipos").update({ status: "closed" }).eq("status", "open").lt("close_date", today);

  const done = (totalPages !== null && nextPage > totalPages) || nextPage > DAILY_REQUEST_CAP;

  // last_synced_date/last_batch_at were already set atomically by the claim
  // above; this just records how far this batch actually got.
  await supabase
    .from("ipo_sync_state")
    .update({ next_page: nextPage, total_pages: totalPages })
    .eq("id", 1);

  return { skipped: false, synced, pagesFetched, totalPages, done, hitRateLimit };
}

export type SyncStateSummary = { lastBatchAt: string | null; done: boolean };

// TEMPORARY test hook — remove once manual testing of the sync is done.
// ipo_sync_state has no RLS policies (service-role only by design), so this
// reads it with the admin client rather than opening up a policy just for
// a temporary test dialog.
export async function getSyncStateSummary(): Promise<SyncStateSummary> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data } = await supabase
    .from("ipo_sync_state")
    .select("last_batch_at, next_page, total_pages")
    .eq("id", 1)
    .single();

  if (!data) return { lastBatchAt: null, done: false };

  const done = (data.total_pages !== null && data.next_page > data.total_pages) || data.next_page > DAILY_REQUEST_CAP;
  return { lastBatchAt: data.last_batch_at, done };
}
