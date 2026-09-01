import { createClient } from "@supabase/supabase-js";
import type { IpoStatus, IpoType } from "@/lib/types";

// Shared by the Vercel Cron route (backup) and the login action (primary
// trigger — first login of each calendar day). Provider: ipoalerts.in —
// free tier: 6 req/min, 25/day, 750/month. Confirmed against a real key:
// `status` is required and only "open"/"upcoming" are allowed on this plan
// ("closed"/"listed" error with "This parameter is not supported for free
// plan users"); `limit` isn't a valid param either — the API always
// returns exactly 1 IPO per page. So this only syncs status=open,
// paginating page-by-page using the response's meta.totalPages, capped at
// MAX_PAGES to stay within the daily quota.

const MAX_PAGES = 25;

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
  | { skipped: false; synced: number; pagesFetched: number; totalPages: number }
  | { skipped: false; error: string };

// Idempotent for a given day: claims `ipo_sync_state` atomically first, so
// if today's sync already ran (or is running elsewhere), this is a no-op.
export async function syncOpenIposIfNeeded(): Promise<SyncResult> {
  if (!process.env.IPO_DATA_API_KEY) {
    return { skipped: false, error: "IPO_DATA_API_KEY is not set." };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const today = new Date().toISOString().slice(0, 10);

  const { data: claimed, error: claimError } = await supabase
    .from("ipo_sync_state")
    .update({ last_synced_date: today })
    .eq("id", 1)
    .lt("last_synced_date", today)
    .select("id");

  if (claimError) {
    return { skipped: false, error: claimError.message };
  }

  if (!claimed || claimed.length === 0) {
    return { skipped: true };
  }

  const byKey = new Map<string, MappedIpo>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= MAX_PAGES) {
    const providerResponse = await fetch(`https://api.ipoalerts.in/ipos?status=open&page=${page}`, {
      headers: { "x-api-key": process.env.IPO_DATA_API_KEY },
    });

    if (!providerResponse.ok) {
      return { skipped: false, error: `ipoalerts.in request failed on page ${page}: ${providerResponse.status}` };
    }

    const payload = (await providerResponse.json()) as IpoAlertsResponse;
    totalPages = payload.meta?.totalPages ?? 1;

    for (const record of payload.ipos ?? []) {
      const mapped = mapRecord(record);
      if (mapped) byKey.set(`${mapped.name}|${mapped.type}`, mapped);
    }

    page += 1;
  }

  const mapped = Array.from(byKey.values());

  if (mapped.length === 0) {
    return { skipped: false, synced: 0, pagesFetched: page - 1, totalPages };
  }

  const { error, count } = await supabase
    .from("ipos")
    .upsert(
      mapped.map((ipo) => ({ ...ipo, last_synced_at: new Date().toISOString() })),
      { onConflict: "name,type", count: "exact" },
    );

  if (error) {
    return { skipped: false, error: error.message };
  }

  return { skipped: false, synced: count ?? mapped.length, pagesFetched: page - 1, totalPages };
}
