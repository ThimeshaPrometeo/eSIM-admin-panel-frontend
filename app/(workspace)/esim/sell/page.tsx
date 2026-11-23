import type { Metadata } from "next";
import { Suspense } from "react";
import { SellClient } from "./sell-client";

export const metadata: Metadata = { title: "Sell eSIM" };

export default function SellPage() {
  return (
    <Suspense>
      <SellClient />
    </Suspense>
  );
}
