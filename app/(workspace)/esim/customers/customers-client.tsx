"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerDialog } from "@/components/platform/customer-dialog";
import { DataTable, type Column } from "@/components/platform/data-table";
import { FilterSelect, SearchInput } from "@/components/platform/fields";
import { FitPage } from "@/components/platform/fit-page";
import { PageHeader } from "@/components/platform/primitives";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { peopleApi } from "@/lib/api/people";
import { formatDate } from "@/lib/platform/dates";
import type { Customer } from "@/lib/platform/types";

/** Customers (spec 8.16): resellers see their own; admin and staff see everyone's, including direct customers. */
export function CustomersClient() {
  const router = useRouter();
  const { me, isTenant, rules } = usePermission();
  const [q, setQ] = useState("");
  const [owner, setOwner] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const resellers = useResource(() => peopleApi.listResellerOptions(), ["reseller-options"], isTenant);
  const { data, loading, error } = useResource(() => peopleApi.listCustomers({ q, resellerId: owner === null ? undefined : owner === "direct" ? null : owner }), [q, owner]);
  const manage = rules.canManageCustomers(me);

  const columns: Column<Customer>[] = [
    {
      id: "name",
      header: "Name",
      hideable: false,
      cell: (c) => (
        <Link href={`/esim/customers/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primary">
          {c.name}
        </Link>
      ),
      sortValue: (c) => c.name,
    },
    { id: "email", header: "Email", cell: (c) => c.email || <span className="text-fg-3">—</span>, sortValue: (c) => c.email },
    { id: "phone", header: "Phone", cell: (c) => <span className="tabular">{c.phone || "—"}</span> },
    ...(isTenant ? [{ id: "reseller", header: "Reseller", cell: (c: Customer) => c.resellerName ?? <span className="text-fg-2">Direct</span>, sortValue: (c: Customer) => c.resellerName ?? "" }] : []),
    { id: "esims", header: "eSIMs", align: "right", cell: (c) => <span className="tabular">{c.esimCount}</span>, sortValue: (c) => c.esimCount },
    { id: "since", header: "Customer since", cell: (c) => <span className="text-fg-2">{formatDate(c.createdAt)}</span>, sortValue: (c) => c.createdAt },
  ];

  return (
    <FitPage>
      <PageHeader
        title="Customers"
        description={isTenant ? "Everyone using an eSIM: resellers' customers and our direct customers." : "The people using your eSIMs."}
        actions={
          manage ? (
            <Button onClick={() => setAdding(true)}>
              <Plus strokeWidth={1.5} />
              Add customer
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={data}
        loading={loading}
        error={error}
        columns={columns}
        rowKey={(c) => c.id}
        onRowClick={(c) => router.push(`/esim/customers/${c.id}`)}
        defaultSort={{ id: "name" }}
        caption="Customers"
        toolbar={
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search name or email" />
            {isTenant ? (
              <FilterSelect
                label="Reseller"
                value={owner}
                onChange={setOwner}
                all="Everyone"
                options={[{ value: "direct", label: "Direct customers" }, ...(resellers.data ?? []).map((r) => ({ value: r.id, label: r.name }))]}
              />
            ) : null}
          </>
        }
        empty={{ title: "No customers match", description: q ? "Try another name or email." : "Customers are added when selling an eSIM, or here.", illustration: "sim" }}
      />
      <CustomerDialog open={adding} customer={null} onOpenChange={setAdding} />
    </FitPage>
  );
}
