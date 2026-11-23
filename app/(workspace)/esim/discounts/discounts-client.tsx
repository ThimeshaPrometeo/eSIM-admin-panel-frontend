"use client";

import { FitPage } from "@/components/platform/fit-page";
import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/platform/confirm-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { DiscountForm } from "@/components/platform/discount-dialog";
import { ResellerSelect } from "@/components/platform/fields";
import { PageHeader } from "@/components/platform/primitives";
import { useAction } from "@/hooks/use-action";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { catalogueApi } from "@/lib/api/catalogue";
import { formatDate } from "@/lib/platform/dates";
import type { Discount } from "@/lib/platform/types";

/** Discounts (spec 8.14): per reseller %, optionally per plan; the most specific wins. Admin manages. */
export function DiscountsClient() {
  const { me, rules } = usePermission();
  const canEdit = rules.canEditDiscounts(me);
  const [resellerId, setResellerId] = useState<string | null>(null);
  const { data, loading, error } = useResource(() => catalogueApi.listDiscounts(), ["discounts"]);
  const [editing, setEditing] = useState<Discount | null | undefined>(undefined);
  const [removing, setRemoving] = useState<Discount | null>(null);
  const { run } = useAction();
  const rows = (data ?? []).filter((d) => !resellerId || d.resellerId === resellerId);

  const columns: Column<Discount>[] = [
    {
      id: "reseller",
      header: "Reseller",
      cell: (d) => (
        <Link href={`/esim/resellers/${d.resellerId}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary">
          {d.resellerName}
        </Link>
      ),
      sortValue: (d) => d.resellerName,
      hideable: false,
    },
    { id: "plan", header: "Applies to", cell: (d) => d.planName ?? <span className="text-fg-2">All plans</span>, sortValue: (d) => d.planName ?? "" },
    { id: "pct", header: "Discount", align: "right", cell: (d) => <span className="font-medium">{d.percent}%</span>, sortValue: (d) => d.percent },
    { id: "kind", header: "Priority", cell: (d) => <span className="text-small text-fg-2">{d.planId ? "Wins on this plan" : "Default for the reseller"}</span> },
    { id: "since", header: "Since", cell: (d) => formatDate(d.createdAt), sortValue: (d) => d.createdAt },
    ...(canEdit
      ? [
          {
            id: "actions",
            header: "",
            hideable: false,
            align: "right" as const,
            cell: (d: Discount) => (
              <span className="inline-flex gap-1">
                <Button variant="ghost" size="icon-sm" aria-label="Edit discount" onClick={() => setEditing(d)}>
                  <Pencil strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Remove discount" onClick={() => setRemoving(d)}>
                  <Trash2 strokeWidth={1.5} />
                </Button>
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <FitPage>
      <PageHeader
        title="Discounts"
        description="A percentage off a reseller's price per MB, for all plans or one plan. The plan-specific discount wins."
        actions={
          canEdit ? (
            <Button onClick={() => setEditing(null)}>
              <Plus strokeWidth={1.75} />
              Add discount
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data ? rows : undefined}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(d) => d.id}
        caption="Discounts"
        toolbar={<ResellerSelect value={resellerId} onChange={setResellerId} />}
        empty={{ title: "No discounts", description: "Resellers pay their markup price in full.", illustration: "signal" }}
      />
      <Dialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)}>
        <DialogContent className="sm:max-w-xl">{editing !== undefined ? <DiscountForm discount={editing} onDone={() => setEditing(undefined)} /> : null}</DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Remove this discount?"
        description={`${removing?.resellerName ?? ""} pays the full price${removing?.planName ? ` on ${removing.planName}` : ""} from now on.`}
        confirmLabel="Remove discount"
        destructive
        onConfirm={async () => {
          const r = await run(() => catalogueApi.deleteDiscount(removing!.id), { success: "Discount removed" });
          if (r.ok) setRemoving(null);
        }}
      />
    </FitPage>
  );
}
