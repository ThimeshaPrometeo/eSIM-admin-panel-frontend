"use client";

import { Info, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import {
  canToggle,
  enabledCount,
  levelOf,
  sectionState,
  setAction,
  setManage,
  setSection,
  setView,
  type Grants,
  type MatrixRow,
  type MatrixSection,
} from "@/lib/platform/permission-matrix";

/**
 * Permission matrix (spec 8.17, 8.25). Grouped by navigation section, with
 * View and Manage switches per tab ("–" where a switch doesn't apply), a
 * section switch, and switches outside the envelope disabled with an
 * explanation. All rules live in lib/platform/permission-matrix.ts.
 */
export function PermissionMatrix({
  sections,
  value,
  envelope,
  onChange,
  readOnly,
  envelopeReason = "Not available: your own account doesn't have this.",
  idPrefix = "pm",
}: {
  sections: MatrixSection[];
  value: Grants;
  envelope: Grants;
  onChange?: (next: Grants) => void;
  readOnly?: boolean;
  envelopeReason?: string;
  idPrefix?: string;
}) {
  const { enabled, total } = enabledCount(value, sections);
  const change = (next: Grants) => !readOnly && onChange?.(next);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-fg-2">
        <span className="font-medium text-fg tabular">{enabled}</span> of <span className="tabular">{total}</span> areas enabled
      </p>
      <div className="glass-card overflow-hidden">
        <div className="hidden grid-cols-[1fr_88px_88px] items-center gap-2 border-b border-border px-5 py-3 text-small font-medium text-fg-2 sm:grid">
          <span>Area</span>
          <span className="text-center">View</span>
          <span className="text-center">Manage</span>
        </div>
        {sections.map((section, si) => {
          const state = sectionState(value, section, envelope);
          const sectionId = `${idPrefix}-${section.id}`;
          const anyAllowed = section.rows.some((r) => canToggle(r, envelope, "view") || canToggle(r, envelope, "manage"));
          return (
            <div key={section.id} className={cn(si > 0 && "border-t border-border")}>
              <div className="flex items-center justify-between gap-3 bg-[color-mix(in_oklab,var(--surface-2)_55%,transparent)] px-5 py-3">
                <label htmlFor={sectionId} className="text-body font-semibold">
                  {section.label}
                </label>
                <span className="flex items-center gap-2">
                  {state === "mixed" ? <span className="text-small text-fg-3">Some</span> : null}
                  <Switch
                    id={sectionId}
                    checked={state === "on"}
                    disabled={readOnly || !anyAllowed}
                    aria-label={`All of ${section.label}`}
                    className={cn(state === "mixed" && "border-primary/60")}
                    onCheckedChange={(on) => change(setSection(value, section, envelope, on))}
                  />
                </span>
              </div>
              {section.rows.map((row) => (
                <Row key={row.module} row={row} value={value} envelope={envelope} readOnly={readOnly} reason={envelopeReason} onChange={change} idPrefix={idPrefix} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Row({
  row,
  value,
  envelope,
  readOnly,
  reason,
  onChange,
  idPrefix,
}: {
  row: MatrixRow;
  value: Grants;
  envelope: Grants;
  readOnly?: boolean;
  reason: string;
  onChange: (next: Grants) => void;
  idPrefix: string;
}) {
  const level = levelOf(value, row.module);
  const viewAllowed = canToggle(row, envelope, "view");
  const manageAllowed = canToggle(row, envelope, "manage");
  const outside = row.kind === "action" ? !manageAllowed : !viewAllowed || (row.kind === "both" && !manageAllowed);
  const id = `${idPrefix}-${row.module}`;

  const cell = (kind: "view" | "manage") => {
    if (row.kind === "action") {
      if (kind === "view") return <Dash />;
      return (
        <Gated allowed={manageAllowed} reason={reason}>
          <Switch
            id={`${id}-action`}
            aria-label={`${row.label}: allowed`}
            checked={level === "manage"}
            disabled={readOnly || !manageAllowed}
            onCheckedChange={(on) => onChange(setAction(value, row, envelope, on))}
          />
        </Gated>
      );
    }
    if (kind === "manage" && row.kind === "view") return <Dash />;
    const allowed = kind === "view" ? viewAllowed : manageAllowed;
    const checked = kind === "view" ? level !== "none" : level === "manage";
    return (
      <Gated allowed={allowed} reason={reason}>
        <Switch
          id={`${id}-${kind}`}
          aria-label={`${row.label}: ${kind === "view" ? "view" : (row.manageLabel ?? "manage").toLowerCase()}`}
          checked={checked}
          disabled={readOnly || !allowed}
          onCheckedChange={(on) => onChange(kind === "view" ? setView(value, row, envelope, on) : setManage(value, row, envelope, on))}
        />
      </Gated>
    );
  };

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 border-t border-border/60 px-5 py-3 first:border-t-0 sm:grid-cols-[1fr_88px_88px] sm:gap-2">
      <div className="min-w-0">
        <p className={cn("text-body", outside && "text-fg-3")}>{row.label}</p>
        <p className="text-small text-fg-3">
          {row.kind === "view" ? "View only" : row.kind === "action" ? "Action" : row.manageLabel ? `View or ${row.manageLabel.toLowerCase()}` : "View or manage"}
        </p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] text-fg-3 sm:hidden">View</span>
        {cell("view")}
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="text-[11px] text-fg-3 sm:hidden">{row.kind === "action" ? "Allowed" : (row.manageLabel ?? "Manage")}</span>
        {cell("manage")}
      </div>
    </div>
  );
}

function Dash() {
  return (
    <span className="grid h-6 w-10 place-items-center text-fg-3" aria-label="Not applicable">
      <Minus className="size-4" strokeWidth={1.5} />
    </span>
  );
}

function Gated({ allowed, reason, children }: { allowed: boolean; reason: string; children: React.ReactNode }) {
  if (allowed) return <>{children}</>;
  return (
    <Tooltip content={reason}>
      <span className="relative inline-flex items-center" tabIndex={0} aria-label={reason}>
        {children}
        <Info className="absolute -right-4 size-3 text-fg-3" strokeWidth={1.5} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
