import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import type { Ipo, Pool } from "@/lib/types";
import { CreatePoolForm, JoinPoolForm, QuickJoinButton } from "./pool-forms";
import { Badge } from "@/components/ui/badge";
import { colorFromSeed } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PoolWithMembers = Pool & { pool_members: { profiles: { display_name: string } | null }[] };

export default async function PoolsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: pools }, { count: panCount }, { data: ipos }, { data: myMemberships }] = await Promise.all([
    supabase
      .from("pools")
      .select("id, name, owner_id, invite_code, ipo_id, category, created_at, pool_members(profiles(display_name))")
      .order("created_at", { ascending: false })
      .returns<PoolWithMembers[]>(),
    supabase.from("pan_cards").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    supabase
      .from("ipos")
      .select("id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status")
      .in("status", ["upcoming", "open"])
      .order("open_date", { ascending: false })
      .returns<Ipo[]>(),
    supabase.from("pool_members").select("pool_id").eq("profile_id", user.id),
  ]);

  const hasPan = (panCount ?? 0) > 0;
  const joinedPoolIds = new Set((myMemberships ?? []).map((m) => m.pool_id));
  const yourPools = pools?.filter((p) => joinedPoolIds.has(p.id)) ?? [];
  const otherPools = pools?.filter((p) => !joinedPoolIds.has(p.id)) ?? [];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Pools</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Every pool is visible to everyone — pick one for an IPO/category you're interested in, or start your own.
        Once you join, you can see every member's PAN number to verify who's actually in.
      </p>

      {!hasPan && (
        <p className="mb-6 rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground">
          You need at least one PAN card before you can create or join a pool.{" "}
          <Link href="/profile/pan" className="underline">
            Add one here
          </Link>
          .
        </p>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <CreatePoolForm ipos={ipos ?? []} />
        <JoinPoolForm />
      </div>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Your pools</h2>
        <div className="flex flex-col gap-2">
          {yourPools.map((pool) => (
            <PoolRow key={pool.id} pool={pool} />
          ))}
          {yourPools.length === 0 && (
            <p className="text-sm text-muted-foreground">You&apos;re not in any pools yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Discover other pools</h2>
        <div className="flex flex-col gap-2">
          {otherPools.map((pool) => (
            <PoolRow key={pool.id} pool={pool} canJoin hasPan={hasPan} />
          ))}
          {otherPools.length === 0 && (
            <p className="text-sm text-muted-foreground">No other pools yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function PoolRow({
  pool,
  canJoin,
  hasPan,
}: {
  pool: PoolWithMembers;
  canJoin?: boolean;
  hasPan?: boolean;
}) {
  const memberNames = (pool.pool_members ?? []).map((m) => m.profiles?.display_name ?? "Member");
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg border border-l-4 p-3 text-sm"
      style={{ borderLeftColor: colorFromSeed(pool.ipo_id) }}
    >
      <Link href={`/pools/${pool.id}`} className="flex flex-1 items-start gap-2 hover:underline">
        <span
          aria-hidden
          className="mt-1.5 size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: colorFromSeed(pool.ipo_id) }}
        />
        <span className="flex flex-col">
          <span className="font-medium">{pool.name}</span>
          <span className="text-xs text-muted-foreground">
            {memberNames.length > 0 ? memberNames.join(", ") : "No members yet"}
          </span>
        </span>
      </Link>
      <Badge variant="secondary" className="uppercase">
        {pool.category}
      </Badge>
      {canJoin ? (
        hasPan ? (
          <QuickJoinButton inviteCode={pool.invite_code} />
        ) : (
          <span className="text-xs text-muted-foreground">Add a PAN card to join</span>
        )
      ) : (
        <span className="font-mono text-xs text-muted-foreground">{pool.invite_code}</span>
      )}
    </div>
  );
}
