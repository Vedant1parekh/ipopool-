import Link from "next/link";
import { requireUser } from "@/lib/supabase/require-user";
import type { Pool } from "@/lib/types";
import { CreatePoolForm, JoinPoolForm } from "./pool-forms";

export const dynamic = "force-dynamic";

export default async function PoolsPage() {
  const { supabase, user } = await requireUser();

  const [{ data: pools }, { count: panCount }] = await Promise.all([
    supabase
      .from("pools")
      .select("id, name, owner_id, invite_code, created_at")
      .order("created_at", { ascending: false })
      .returns<Pool[]>(),
    supabase.from("pan_cards").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);

  const hasPan = (panCount ?? 0) > 0;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Your pools</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Each pool is isolated — members only see the applications and data inside their own pool.
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
        <CreatePoolForm />
        <JoinPoolForm />
      </div>

      <div className="flex flex-col gap-2">
        {pools?.map((pool) => (
          <Link
            key={pool.id}
            href={`/pools/${pool.id}`}
            className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-muted"
          >
            <span className="font-medium">{pool.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{pool.invite_code}</span>
          </Link>
        ))}
        {(!pools || pools.length === 0) && (
          <p className="text-sm text-muted-foreground">You&apos;re not in any pools yet.</p>
        )}
      </div>
    </main>
  );
}
