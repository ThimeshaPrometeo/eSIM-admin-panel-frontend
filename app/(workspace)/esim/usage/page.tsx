import type { Metadata } from "next";
import { Suspense } from "react";
import { UsageClient } from "./usage-client";

export const metadata: Metadata = { title: "Usage" };

export default function Page() {
  return (
    <Suspense>
      <UsageClient />
    </Suspense>
  );
}
