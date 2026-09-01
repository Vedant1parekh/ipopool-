import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/require-user";
import type { IpoDetails } from "@/lib/types";
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

export const dynamic = "force-dynamic";

export default async function IpoDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const { data: ipo } = await supabase
    .from("ipos")
    .select(
      "id, name, type, open_date, close_date, listing_date, price_band_min, price_band_max, lot_size, status, symbol, slug, logo_url, about, strengths, risks, schedule, issue_size, min_amount, prospectus_url, nse_info_url, bse_info_url, type_of_issue",
    )
    .eq("id", id)
    .maybeSingle<IpoDetails>();

  if (!ipo) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-start gap-4">
        {ipo.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ipo.logo_url} alt="" className="size-12 rounded-md border object-contain" />
        )}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{ipo.name}</h1>
            <StatusBadge status={ipo.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {ipo.symbol && <span className="font-mono">{ipo.symbol}</span>}
            {ipo.symbol && " · "}
            <span className="uppercase">{ipo.type}</span>
            {ipo.type_of_issue && ` · ${ipo.type_of_issue}`}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
            <Info label="Open date" value={ipo.open_date} />
            <Info label="Close date" value={ipo.close_date} />
            <Info label="Listing date" value={ipo.listing_date} />
            <Info
              label="Price band"
              value={ipo.price_band_min && ipo.price_band_max ? `₹${ipo.price_band_min}–${ipo.price_band_max}` : null}
            />
            <Info label="Lot size" value={ipo.lot_size} />
            <Info label="Min investment" value={ipo.min_amount ? `₹${ipo.min_amount}` : null} />
            <Info label="Issue size" value={ipo.issue_size} />
          </dl>
        </CardContent>
      </Card>

      {ipo.about && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{ipo.about}</p>
          </CardContent>
        </Card>
      )}

      {(ipo.strengths?.length || ipo.risks?.length) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {ipo.strengths && ipo.strengths.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Strengths</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {ipo.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          {ipo.risks && ipo.risks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risks</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                  {ipo.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {ipo.schedule && ipo.schedule.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ipo.schedule.map((event, i) => (
                  <TableRow key={i}>
                    <TableCell>{event.event}</TableCell>
                    <TableCell>{event.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {(ipo.prospectus_url || ipo.nse_info_url || ipo.bse_info_url) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm">
            {ipo.prospectus_url && (
              <a href={ipo.prospectus_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Prospectus (RHP)
              </a>
            )}
            {ipo.nse_info_url && (
              <a href={ipo.nse_info_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                NSE issue information
              </a>
            )}
            {ipo.bse_info_url && (
              <a href={ipo.bse_info_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                BSE issue information
              </a>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: IpoDetails["status"] }) {
  const variants: Record<IpoDetails["status"], string> = {
    open: "bg-primary text-primary-foreground",
    upcoming: "bg-secondary text-secondary-foreground",
    closed: "bg-warning text-warning-foreground",
    listed: "bg-success text-success-foreground",
  };
  return <Badge className={`uppercase ${variants[status]}`}>{status}</Badge>;
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <dt className="text-muted-foreground/70">{label}</dt>
      <dd className="text-foreground">{value ?? "—"}</dd>
    </div>
  );
}
