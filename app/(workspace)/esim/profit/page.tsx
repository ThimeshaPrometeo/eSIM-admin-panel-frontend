import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfitClient } from "./profit-client";

export const metadata: Metadata = { title: "Profit and costs" };

export default function Page() {
  return (
    <Suspense>
      <ProfitClient />
    </Suspense>
  );
}
