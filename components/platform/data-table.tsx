"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";
import { EmptyState } from "./primitives";
import { useFit } from "./fit-page";

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Makes the column sortable. */
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
  className?: string;
  /** Can be hidden from the Columns menu (default true). */
  hideable?: boolean;
  defaultHidden?: boolean;
};

/**
 * List table (spec 8, 7.8): sticky glass header, sortable columns,
 * pagination, column visibility, loading skeletons, empty and error states.
 * Search and filters sit in the toolbar slot above it.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  toolbar,
  actions,
  empty,
  onRowClick,
  pageSize = 20,
  defaultSort,
  className,
  caption,
}: {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  toolbar?: ReactNode;
  actions?: ReactNode;
  empty?: { title: string; description: string; action?: ReactNode; illustration?: "sim" | "globe" | "signal" };
  onRowClick?: (row: T) => void;
  pageSize?: number;
  defaultSort?: { id: string; desc?: boolean };
  className?: string;
  caption?: string;
}) {
  const [sort, setSort] = useState<{ id: string; desc: boolean } | null>(defaultSort ? { id: defaultSort.id, desc: !!defaultSort.desc } : null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id)));
  const [page, setPage] = useState(1);
  const fit = useFit();
  if (fit) pageSize = Math.max(pageSize, 50);
  const visible = columns.filter((c) => !hidden.has(c.id));

  const sorted = useMemo(() => {
    const list = rows ?? [];
    const col = sort && columns.find((c) => c.id === sort.id);
    if (!col?.sortValue) return list;
    const get = col.sortValue;
    return [...list].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x === y) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en-GB", { numeric: true });
      return sort!.desc ? -r : r;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages);
  const shown = sorted.slice((current - 1) * pageSize, current * pageSize);
  const hideable = columns.filter((c) => c.hideable !== false);

  return (
    <div className={cn("flex flex-col gap-4", fit && "min-h-0 flex-1", className)}>
      {toolbar || actions || hideable.length > 2 ? (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" onChange={() => setPage(1)}>
            {toolbar}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {hideable.length > 2 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <Columns3 strokeWidth={1.5} />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                  {hideable.map((c) => (
                    <DropdownMenuItem
                      key={c.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        setHidden((h) => {
                          const n = new Set(h);
                          if (n.has(c.id)) n.delete(c.id);
                          else if (visible.length > 1) n.add(c.id);
                          return n;
                        });
                      }}
                    >
                      <span className={cn("grid size-4 place-items-center rounded-[4px] border", hidden.has(c.id) ? "border-border-strong" : "border-primary bg-primary-solid")}>
                        {!hidden.has(c.id) ? <span className="size-1.5 rounded-[1px] bg-on-solid" /> : null}
                      </span>
                      {c.header}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn("glass-card overflow-hidden", fit && "flex min-h-0 flex-1 flex-col")}>
        {error ? (
          <EmptyState illustration="signal" title="This list didn't load" description={errorMessage(error)} />
        ) : loading && !rows ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState illustration={empty?.illustration ?? "sim"} title={empty?.title ?? "Nothing here yet"} description={empty?.description ?? "Try another search or filter."} action={empty?.action} />
        ) : (
          <Table containerClassName={fit ? "min-h-0 flex-1" : undefined}>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
            <TableHeader>
              <tr>
                {visible.map((c) => {
                  const active = sort?.id === c.id;
                  return (
                    <TableHead key={c.id} className={cn(c.align === "right" && "text-right", c.className)} aria-sort={active ? (sort!.desc ? "descending" : "ascending") : undefined}>
                      {c.sortValue ? (
                        <button
                          className={cn("inline-flex items-center gap-1 rounded transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-primary", active && "text-fg", c.align === "right" && "flex-row-reverse")}
                          onClick={() => setSort((s) => (s?.id === c.id ? (s.desc ? null : { id: c.id, desc: true }) : { id: c.id, desc: false }))}
                        >
                          {c.header}
                          {active ? sort!.desc ? <ArrowDown className="size-3.5" strokeWidth={1.75} /> : <ArrowUp className="size-3.5" strokeWidth={1.75} /> : null}
                        </button>
                      ) : (
                        c.header
                      )}
                    </TableHead>
                  );
                })}
              </tr>
            </TableHeader>
            <TableBody className={cn(loading && "opacity-60 transition-opacity")}>
              {shown.map((row) => (
                <TableRow key={rowKey(row)} className={cn(onRowClick && "cursor-pointer")} onClick={onRowClick ? () => onRowClick(row) : undefined}>
                  {visible.map((c) => (
                    <TableCell key={c.id} className={cn(c.align === "right" && "text-right tabular", c.className)}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {sorted.length > pageSize ? (
        <div className="flex items-center justify-between gap-3 text-small text-fg-2">
          <span className="tabular">
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={current <= 1} onClick={() => setPage(current - 1)}>
              <ChevronLeft strokeWidth={1.5} />
            </Button>
            <span className="px-2 tabular">
              Page {current} of {pages}
            </span>
            <Button variant="ghost" size="icon-sm" aria-label="Next page" disabled={current >= pages} onClick={() => setPage(current + 1)}>
              <ChevronRight strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
