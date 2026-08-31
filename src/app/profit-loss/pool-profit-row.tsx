"use client";

import { useActionState, useState } from "react";
import { setApplicationFinancials } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TableCell } from "@/components/ui/table";

const initialState = { error: null as string | null };
const selectClass =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PoolProfitRow({
  applicationId,
  memberCount,
  initial,
}: {
  applicationId: string;
  memberCount: number;
  initial: {
    amountDeducted: number | null;
    amountReceived: number | null;
    paymentStatus: string;
    remarks: string | null;
  };
}) {
  const [deducted, setDeducted] = useState(initial.amountDeducted?.toString() ?? "");
  const [received, setReceived] = useState(initial.amountReceived?.toString() ?? "");
  const [paymentStatus, setPaymentStatus] = useState(initial.paymentStatus);
  const [remarks, setRemarks] = useState(initial.remarks ?? "");

  const [state, formAction, pending] = useActionState(async () => {
    return (
      (await setApplicationFinancials(applicationId, {
        amountDeducted: Number(deducted) || 0,
        amountReceived: Number(received) || 0,
        paymentStatus,
        remarks,
      })) ?? initialState
    );
  }, initialState);

  const gross = deducted !== "" && received !== "" ? Number(received) - Number(deducted) : null;
  const tax = gross !== null ? Math.max(gross, 0) * 0.208 : null;
  const net = gross !== null && tax !== null ? gross - tax : null;
  const perPerson = net !== null ? net / memberCount : null;

  return (
    <>
      <TableCell>
        <Input
          value={deducted}
          onChange={(e) => setDeducted(e.target.value)}
          type="number"
          step="0.01"
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell>
        <Input
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          type="number"
          step="0.01"
          className="h-8 w-24"
        />
      </TableCell>
      <TableCell className={gross !== null && gross < 0 ? "text-destructive" : ""}>
        {gross !== null ? `₹${gross.toFixed(2)}` : "—"}
      </TableCell>
      <TableCell>{tax !== null ? `₹${tax.toFixed(2)}` : "—"}</TableCell>
      <TableCell className={`font-medium ${net !== null && net < 0 ? "text-destructive" : "text-success"}`}>
        {net !== null ? `₹${net.toFixed(2)}` : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {(100 / memberCount).toFixed(1)}% each ({memberCount})
      </TableCell>
      <TableCell>{perPerson !== null ? `₹${perPerson.toFixed(2)}` : "—"}</TableCell>
      <TableCell>
        <select
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value)}
          className={selectClass}
        >
          <option value="pending">Pending</option>
          <option value="done">Done</option>
        </select>
      </TableCell>
      <TableCell>
        <Input
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks"
          className="h-8 w-32"
        />
      </TableCell>
      <TableCell>
        <Button size="sm" disabled={pending} onClick={() => formAction()}>
          {pending ? "Saving..." : "Save"}
        </Button>
        {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      </TableCell>
    </>
  );
}
