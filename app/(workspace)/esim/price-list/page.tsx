import type { Metadata } from "next";
import { Suspense } from "react";
import { PriceListClient } from "./price-list-client";

export const metadata: Metadata = { title: "Price list" };

export default function PriceListPage() {
  return (
    <Suspense>
      <PriceListClient />
    </Suspense>
  );
}
