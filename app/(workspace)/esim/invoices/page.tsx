import type { Metadata } from "next";
import { InvoicesClient } from "./invoices-client";

export const metadata: Metadata = { title: "Invoices" };

export default function Page() {
  return <InvoicesClient />;
}
