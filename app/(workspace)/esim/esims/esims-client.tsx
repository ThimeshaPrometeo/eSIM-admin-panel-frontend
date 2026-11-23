"use client";

import { FitPage } from "@/components/platform/fit-page";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/platform/data-table";
import { esimColumns } from "@/components/platform/esim-columns";
import { FilterSelect, ResellerSelect, SearchInput } from "@/components/platform/fields";
import { PageHeader } from "@/components/platform/primitives";
import { usePermission } from "@/hooks/use-permission";
import { useResource } from "@/hooks/use-resource";
import { logDownload } from "@/lib/api/audit";
import { catalogueApi } from "@/lib/api/catalogue";
import { esimsApi, type EsimFilters } from "@/lib/api/esims";
import { exportCsv } from "@/lib/exports";
import { esimStatus, installStatus, PLAN_STATE } from "@/lib/platform/status";
import type { InstallStatus, PlanState } from "@/lib/platform/status";
import type { Esim } from "@/lib/platform/types";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED_ANY", label: "Suspended" },
  { value: "END_OF_LIFE", label: "End of life" },
  { value: "INACTIVE", label: "Inactive" },
] as const;
const INSTALL_OPTIONS: InstallStatus[] = ["not_installed", "downloaded", "installed", "enabled", "disabled", "unknown"];
const PLAN_STATE_OPTIONS: (PlanState | "blocked")[] = ["active", "pending_first_use", "awaiting_funds", "blocked", "expired"];

/** eSIM list (spec 8.2). Resellers and assistants see only their own eSIMs. */
export function EsimsClient() {
  const router = useRouter();
  const { me, isTenant, rules } = usePermission();
  const [f, setF] = useState<EsimFilters>({});
  const set = (patch: Partial<EsimFilters>) => setF((x) => ({ ...x, ...patch }));
  const { data, loading, error } = useResource(() => esimsApi.listEsims(f), [f]);
  const plans = useResource(() => catalogueApi.listPlansCatalogue(), ["catalogue"]);
  const rows = data?.data;

  const exportList = async () => {
    if (!rows) return;
    exportCsv<Esim>(
      `esims-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        { header: "ICCID", value: (e) => e.iccid },
        { header: "Status", value: (e) => esimStatus(e.status, e.suspendedBy).label },
        { header: "Install status", value: (e) => installStatus(e.installStatus, e.installStatusRaw).label },
        { header: "Current plan", value: (e) => e.plans[0]?.name ?? "" },
        { header: "Plan state", value: (e) => (e.plans[0] ? PLAN_STATE[e.plans[0].state].label : "") },
        { header: "Data used (MB)", value: (e) => Math.round(e.usedBytes / 1048576) },
        { header: "Data limit (MB)", value: (e) => Math.round(e.limitBytes / 1048576) },
        { header: "Expires", value: (e) => e.expiresAt ?? "" },
        { header: "Customer", value: (e) => e.customerName ?? "" },
        ...(isTenant ? [{ header: "Reseller", value: (e: Esim) => e.resellerName ?? "Direct" }] : []),
        { header: "Last activity", value: (e) => e.lastActivityAt ?? "" },
      ],
      rows,
    );
    await logDownload("esim_list", "csv");
    toast.success("CSV downloaded");
  };

  return (
    <FitPage>
      <PageHeader
        title={isTenant ? "All eSIMs" : "My eSIMs"}
        description={isTenant ? "Every eSIM: direct sales and every reseller's." : "The eSIMs you've sold, their plans and data use."}
        actions={
          rules.canSell(me) ? (
            <Button asChild>
              <Link href="/esim/sell">
                <Plus strokeWidth={1.75} />
                Sell eSIM
              </Link>
            </Button>
          ) : null
        }
      />
      <DataTable
        rows={rows}
        loading={loading}
        error={error}
        columns={esimColumns({ reseller: isTenant })}
        rowKey={(e) => e.id}
        onRowClick={(e) => router.push(`/esim/esims/${e.id}`)}
        pageSize={20}
        caption="eSIMs"
        toolbar={
          <>
            <SearchInput value={f.q ?? ""} onChange={(q) => set({ q })} placeholder="Search ICCID or customer" />
            <FilterSelect label="Status" value={f.status ?? null} onChange={(status) => set({ status })} all="Any status" options={STATUS_OPTIONS.map((o) => ({ ...o }))} className="sm:w-40" />
            <FilterSelect label="Install status" value={f.installStatus ?? null} onChange={(installStatus) => set({ installStatus })} all="Any install status" options={INSTALL_OPTIONS.map((s) => ({ value: s, label: s === "unknown" ? "Other" : installStatus(s).label }))} className="sm:w-44" />
            <FilterSelect label="Plan state" value={f.planState ?? null} onChange={(planState) => set({ planState })} all="Any plan state" options={PLAN_STATE_OPTIONS.map((s) => ({ value: s, label: s === "blocked" ? "Blocked" : PLAN_STATE[s].label }))} className="sm:w-44" />
            <FilterSelect
              label="Plan"
              value={f.planId ?? null}
              onChange={(planId) => set({ planId })}
              all="Any plan"
              options={(plans.data ?? []).filter((p) => !p.resellerPlanId).map((p) => ({ value: p.planId, label: p.name }))}
              className="sm:w-40"
            />
            {isTenant ? <ResellerSelect value={f.resellerId ?? null} onChange={(resellerId) => set({ resellerId })} className="sm:w-48" /> : null}
          </>
        }
        actions={
          <Button variant="secondary" size="sm" disabled={!rows?.length} onClick={exportList}>
            <FileDown strokeWidth={1.5} />
            CSV
          </Button>
        }
        empty={{ title: "No eSIMs match", description: "Try another search or filter.", illustration: "sim", action: rules.canSell(me) ? <Button asChild><Link href="/esim/sell">Sell eSIM</Link></Button> : undefined }}
      />
    </FitPage>
  );
}
