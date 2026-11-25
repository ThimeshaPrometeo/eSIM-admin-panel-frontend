import type { Metadata } from "next";
import { Suspense } from "react";
import { EsimsClient } from "./esims-client";

export const metadata: Metadata = { title: "eSIMs" };

export default function EsimsPage() {
  return (
    <Suspense>
      <EsimsClient />
    </Suspense>
  );
}
