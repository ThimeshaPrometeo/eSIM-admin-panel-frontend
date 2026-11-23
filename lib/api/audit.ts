/** Download audit (spec 8.22): every export is logged. The backend logs when it serves the file; demo mode writes the entry here. */
import { DATA_MODE } from "./mode";
import { write } from "@/lib/demo/run";
import { audit, caller } from "@/lib/demo/session";

const demo = (kind: string, reference: string) =>
  write(() => {
    const c = caller();
    audit(c, "document.downloaded", kind, reference, `${kind} downloaded`, c.resellerId);
  });

export const logDownload: (kind: string, reference: string) => Promise<void> = DATA_MODE === "api" ? async () => undefined : demo;
