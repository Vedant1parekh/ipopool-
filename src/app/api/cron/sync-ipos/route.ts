import { syncOpenIposIfNeeded } from "@/lib/ipo-sync";

// Backup trigger for keeping the `ipos` table fresh — the primary trigger
// is any login (see src/app/login/actions.ts). syncOpenIposIfNeeded()
// fetches one batch of pages and resumes across invocations, so this is a
// safe no-op once the day's full page count has already been covered.
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
