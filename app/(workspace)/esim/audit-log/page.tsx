import type { Metadata } from "next";
import { AuditLogClient } from "./audit-log-client";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return <AuditLogClient />;
}
