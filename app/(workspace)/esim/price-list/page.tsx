import type { Metadata } from "next";
import { PriceListClient } from "./price-list-client";

export const metadata: Metadata = { title: "Price list" };

export default function PriceListPage() {
  return <PriceListClient />;
}
