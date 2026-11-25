import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertsClient } from "./alerts-client";

export const metadata: Metadata = { title: "Alerts and rules" };

export default function Page() {
  return (
    <Suspense>
      <AlertsClient />
    </Suspense>
  );
}
