import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import type { Ipo, Pool } from "@/lib/types";
import { CreatePoolForm, JoinPoolForm } from "./pool-forms";
import { quickJoinPool } from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type PoolWithMemberCount = Pool & { pool_members: { count: number }[] };

export default async function PoolsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: pools }, { count: panCount }, { data: ipos }, { data: myMemberships }] = await Promise.all([
    supabase
      .from("pools")
      .select("id, name, owner_id, invite_code, ipo_id, category, created_at, pool_members(count)")
      .order("created_at", { ascending: false })
      .returns<PoolWithMemberCount[]>(),
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
            <PoolRow key={pool.id} pool={pool} joinAction={quickJoinPool.bind(null, pool.invite_code)} />
          ))}
          {otherPools.length === 0 && (
            <p className="text-sm text-muted-foreground">No other pools yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

function PoolRow({ pool, joinAction }: { pool: PoolWithMemberCount; joinAction?: () => Promise<void> }) {
  const memberCount = pool.pool_members?.[0]?.count ?? 0;
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      <Link href={`/pools/${pool.id}`} className="flex flex-1 flex-col hover:underline">
        <span className="font-medium">{pool.name}</span>
        <span className="text-xs text-muted-foreground">
          {memberCount} member{memberCount === 1 ? "" : "s"}
        </span>
      </Link>
      <Badge variant="secondary" className="uppercase">
        {pool.category}
      </Badge>
      {joinAction ? (
        <form action={joinAction}>
          <Button type="submit" size="sm">
            Join
          </Button>
        </form>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">{pool.invite_code}</span>
      )}
    </div>
  );
}
