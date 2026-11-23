/**
 * Client-side exports (spec 10). In demo mode the files are made in the
 * browser; with the backend, exports come from its endpoints and the
 * watermark is applied when serving (backlog BB-6). The PDF libraries load
 * only when someone exports.
 */
import { formatDateTime } from "@/lib/platform/dates";

export type ExportColumn<T> = { header: string; value: (row: T) => string | number | null; width?: number };
export type Watermark = { fullName: string; username: string };

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function watermarkText(w: Watermark, at = new Date()) {
  return `Downloaded by ${w.fullName} (${w.username}) · ${formatDateTime(at.toISOString())}`;
}

export function exportCsv<T>(fileName: string, columns: ExportColumn<T>[], rows: T[]) {
  const esc = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [columns.map((c) => esc(c.header)).join(","), ...rows.map((r) => columns.map((c) => esc(c.value(r))).join(","))].join("\n");
  save(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), fileName);
}

export async function exportXlsx<T>(fileName: string, sheet: string, columns: ExportColumn<T>[], rows: T[]) {
  const { default: writeXlsxFile } = await import("write-excel-file");
  const header = columns.map((c) => ({ value: c.header, fontWeight: "bold" as const }));
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.value(r);
      return v === null ? null : typeof v === "number" ? { value: v, type: Number } : { value: v, type: String };
    }),
  );
  await writeXlsxFile([header, ...body], { fileName, sheet, columns: columns.map((c) => ({ width: c.width ?? 18 })), stickyRowsCount: 1 });
}

/** A landscape table PDF with the download watermark on every page (spec 8.22). */
export async function exportPdf<T>(opts: { fileName: string; title: string; subtitle?: string; columns: ExportColumn<T>[]; rows: T[]; watermark: Watermark; /** false = switched off in Settings for this document type */ watermarkOn?: boolean }) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const mark = watermarkText(opts.watermark);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(opts.title, 40, 44);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  if (opts.subtitle) doc.text(opts.subtitle, 40, 60);
  autoTable(doc, {
    startY: 74,
    head: [opts.columns.map((c) => c.header)],
    body: opts.rows.map((r) => opts.columns.map((c) => c.value(r) ?? "")),
    styles: { font: "helvetica", fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [10, 19, 34], textColor: 255 },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    margin: { left: 40, right: 40 },
  });
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    if (opts.watermarkOn === false) continue;
    // large, diagonal, semi-transparent
    doc.saveGraphicsState();
    doc.setGState(new (doc as unknown as { GState: new (o: { opacity: number }) => unknown }).GState({ opacity: 0.13 }) as never);
    doc.setFontSize(26);
    doc.setTextColor(0, 64, 160);
    doc.text(mark, w / 2, h / 2, { angle: 28, align: "center" });
    doc.restoreGraphicsState();
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`${mark} · Page ${i} of ${pages}`, 40, h - 20);
  }
  doc.save(opts.fileName);
}
