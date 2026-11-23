import type { Metadata } from "next";
import { WalletsClient } from "./wallets-client";

export const metadata: Metadata = { title: "Wallets" };

export default function Page() {
  return <WalletsClient />;
}
