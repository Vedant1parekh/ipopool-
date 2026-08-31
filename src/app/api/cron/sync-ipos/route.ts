import { createClient } from "@supabase/supabase-js";
import type { IpoStatus, IpoType } from "@/lib/types";

// Scheduled by Vercel Cron (see vercel.json) to keep the `ipos` table fresh.
// Uses the service role key because it must bypass RLS to write to `ipos`.
// Provider: ipoalerts.in — self-serve API key from https://ipoalerts.in/signup,
// dashboard → API Keys. Free tier: 6 req/min, 25/day, 750/month, and reportedly
// only 1 IPO per request — if that turns out to mean the *list* endpoint only
// ever returns a single record on the free tier, this sync will need a paid
// plan to be useful; worth confirming against a real key.

const STATUSES = ["open", "upcoming", "closed", "listed"] as const;

type IpoAlertsRecord = {
  name: string;
  type: string; // "EQ" (mainboard) | "SME" | "DEBT"
  status: string; // open | closed | upcoming | listed | announced
  startDate: string | null;
  endDate: string | null;
  listingDate: string | null;
  priceRange: string | null; // e.g. "95-100"
  minQty: number | string | null;
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
  };
}

function extractRecords(payload: unknown): IpoAlertsRecord[] {
  if (Array.isArray(payload)) return payload as IpoAlertsRecord[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as IpoAlertsRecord[];
    if (Array.isArray(obj.ipos)) return obj.ipos as IpoAlertsRecord[];
  }
  return [];
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.IPO_DATA_API_KEY) {
    return Response.json({ error: "IPO_DATA_API_KEY is not set." }, { status: 500 });
  }

  const byKey = new Map<string, MappedIpo>();

  for (const status of STATUSES) {
    const providerResponse = await fetch(`https://api.ipoalerts.in/ipos?status=${status}&limit=100`, {
      headers: { "x-api-key": process.env.IPO_DATA_API_KEY },
    });

    if (!providerResponse.ok) {
      return Response.json(
        { error: `ipoalerts.in request failed for status=${status}: ${providerResponse.status}` },
        { status: 502 },
      );
    }

    const records = extractRecords(await providerResponse.json());
    for (const record of records) {
      const mapped = mapRecord(record);
      if (mapped) byKey.set(`${mapped.name}|${mapped.type}`, mapped);
    }
  }

  const mapped = Array.from(byKey.values());

  if (mapped.length === 0) {
    return Response.json({ synced: 0 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { error, count } = await supabase
    .from("ipos")
    .upsert(
      mapped.map((ipo) => ({ ...ipo, last_synced_at: new Date().toISOString() })),
      { onConflict: "name,type", count: "exact" },
    );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ synced: count ?? mapped.length });
}
