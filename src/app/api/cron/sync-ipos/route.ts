import { syncOpenIposIfNeeded } from "@/lib/ipo-sync";

// Backup trigger for keeping the `ipos` table fresh — the primary trigger
// is the first login of each calendar day (see src/app/login/actions.ts).
// syncOpenIposIfNeeded() claims the day atomically, so this is a safe no-op
// if a login already synced today.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await syncOpenIposIfNeeded();

  if (!result.skipped && "error" in result) {
    return Response.json({ error: result.error }, { status: 502 });
  }

  return Response.json(result);
}
