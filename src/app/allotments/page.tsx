import { requireUser } from "@/lib/supabase/require-user";
import { maskPan, type AllotmentStatus, type Ipo } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AllotmentActionButtons } from "./allotment-row";

export const dynamic = "force-dynamic";

type ApplicationRow = {
  id: string;
  category: string;
  allotment_status: AllotmentStatus;
  pools: { name: string } | null;
  pan_cards: {
    pan_number: string;
    label: string | null;
    profiles: { display_name: string } | null;
  } | null;
};

export default async function AllotmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ ipo?: string }>;
}) {
  const { supabase } = await requireUser();
  const { ipo: selectedIpoId } = await searchParams;

  const { data: ipos } = await supabase
    .from("ipos")
    .select("id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status")
    .in("status", ["closed", "listed"])
    .order("listing_date", { ascending: false })
    .returns<Ipo[]>();

  let applications: ApplicationRow[] | null = null;
  if (selectedIpoId) {
    const { data } = await supabase
      .from("pool_applications")
      .select(
        "id, category, allotment_status, pools(name), pan_cards(pan_number, label, profiles(display_name))",
      )
      .eq("ipo_id", selectedIpoId)
      .order("created_at", { ascending: true })
      .returns<ApplicationRow[]>();
    applications = data;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Allotment Results</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        See every PAN&apos;s allotment result across all pools you&apos;re a member of, for one IPO at a time.
      </p>

      <Card className="mb-8">
        <CardContent className="pt-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <label className="flex flex-1 min-w-48 flex-col gap-1 text-sm">
              IPO (allotment announced)
              <select
                name="ipo"
                defaultValue={selectedIpoId ?? ""}
                className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="" disabled>
                  Select an IPO
                </option>
                {ipos?.map((ipo) => (
                  <option key={ipo.id} value={ipo.id}>
                    {ipo.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="h-8 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              View
            </button>
          </form>
          {(!ipos || ipos.length === 0) && (
            <p className="mt-3 text-sm text-muted-foreground">
              No IPOs with an announced allotment yet (status must be Closed or Listed).
            </p>
          )}
        </CardContent>
      </Card>

      {selectedIpoId && (
        <Card>
          <CardHeader>
            <CardTitle>Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>PAN</TableHead>
                  <TableHead>Pool</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Update</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications?.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>{app.pan_cards?.profiles?.display_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {app.pan_cards?.label ?? maskPan(app.pan_cards?.pan_number ?? "")}
                    </TableCell>
                    <TableCell>{app.pools?.name ?? "—"}</TableCell>
                    <TableCell className="uppercase text-muted-foreground">{app.category}</TableCell>
                    <TableCell>
                      <AllotmentBadge status={app.allotment_status} />
                    </TableCell>
                    <TableCell>
                      <AllotmentActionButtons applicationId={app.id} />
                    </TableCell>
                  </TableRow>
                ))}
                {(!applications || applications.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                      No applications logged for this IPO in any pool you&apos;re part of.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function AllotmentBadge({ status }: { status: AllotmentStatus }) {
  if (status === "alloted") {
    return <Badge className="bg-success text-success-foreground">Alloted</Badge>;
  }
  if (status === "not_alloted") {
    return <Badge variant="destructive">Not Alloted</Badge>;
  }
  return <Badge variant="secondary">Pending</Badge>;
}
