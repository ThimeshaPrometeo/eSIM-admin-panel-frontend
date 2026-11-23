import type { Metadata } from "next";
import { ProfitClient } from "./profit-client";

export const metadata: Metadata = { title: "Profit and costs" };

export default function Page() {
  return <ProfitClient />;
}
