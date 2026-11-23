import type { Metadata } from "next";
import { AlertsClient } from "./alerts-client";

export const metadata: Metadata = { title: "Alerts and rules" };

export default function Page() {
  return <AlertsClient />;
}
