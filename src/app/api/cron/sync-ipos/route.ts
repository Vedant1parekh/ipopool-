import { createClient } from "@supabase/supabase-js";
import type { IpoStatus, IpoType } from "@/lib/types";

// Scheduled by Vercel Cron (see vercel.json) to keep the `ipos` table fresh.
// Uses the service role key because it must bypass RLS to write to `ipos`.

type IpoGuruRecord = {
  name: string;
  type: string; // "SME" | "Mainboard" (casing not guaranteed by the provider)
  status: string; // "Open" | "Upcoming" | "Closed" | "Listed"
  open_date: string | null;
  close_date: string | null;
  listing_date: string | null;
  price_band: string | null; // e.g. "163-172"
  lot_size: string | null;
};

type IpoGuruResponse = {
  success: boolean;
  data: IpoGuruRecord[];
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

function parsePriceBand(band: string | null): [number | null, number | null] {
  if (!band) return [null, null];
  const parts = band.split("-").map((p) => Number(p.trim()));
  if (parts.length === 2 && parts.every((n) => !Number.isNaN(n))) {
    return [parts[0], parts[1]];
  }
  const single = Number(band.trim());
  return Number.isNaN(single) ? [null, null] : [single, single];
}

function normalizeType(type: string): IpoType {
  return type.toLowerCase().includes("sme") ? "sme" : "mainboard";
}

function normalizeStatus(status: string): IpoStatus {
  const s = status.toLowerCase();
  if (s.includes("open")) return "open";
  if (s.includes("closed")) return "closed";
  if (s.includes("listed")) return "listed";
  return "upcoming";
}

function mapRecord(record: IpoGuruRecord): MappedIpo {
  const [price_band_min, price_band_max] = parsePriceBand(record.price_band);
  return {
    name: record.name,
    type: normalizeType(record.type),
    open_date: record.open_date,
    close_date: record.close_date,
    listing_date: record.listing_date,
    price_band_min,
    price_band_max,
    lot_size: record.lot_size ? Number(record.lot_size) : null,
    status: normalizeStatus(record.status),
    source: "ipoguru",
  };
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!process.env.IPO_DATA_API_KEY) {
    return Response.json({ error: "IPO_DATA_API_KEY is not set." }, { status: 500 });
  }

  const providerResponse = await fetch("https://www.ipoguru.in/api/v1/ipos", {
    headers: { "X-API-KEY": process.env.IPO_DATA_API_KEY },
  });

  if (!providerResponse.ok) {
    return Response.json(
      { error: `IPO Guru request failed: ${providerResponse.status}` },
      { status: 502 },
    );
  }

  const payload = (await providerResponse.json()) as IpoGuruResponse;

  if (!payload.success) {
    return Response.json({ error: "IPO Guru returned success: false" }, { status: 502 });
  }

  const mapped = payload.data.map(mapRecord);

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
