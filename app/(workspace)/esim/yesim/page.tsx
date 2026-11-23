import type { Metadata } from "next";
import { YesimClient } from "./yesim-client";

export const metadata: Metadata = { title: "Yesim connection" };

export default function Page() {
  return <YesimClient />;
}
