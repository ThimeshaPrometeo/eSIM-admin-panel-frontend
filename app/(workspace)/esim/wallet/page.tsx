import type { Metadata } from "next";
import { WalletClient } from "./wallet-client";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletClient />;
}
