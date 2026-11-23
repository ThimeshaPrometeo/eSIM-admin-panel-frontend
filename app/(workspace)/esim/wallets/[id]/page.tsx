import type { Metadata } from "next";
import { WalletDetailClient } from "./wallet-detail-client";

export const metadata: Metadata = { title: "Wallet" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WalletDetailClient id={id} />;
}
