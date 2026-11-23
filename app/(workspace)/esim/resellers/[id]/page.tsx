import type { Metadata } from "next";
import { ResellerDetailClient } from "./reseller-detail-client";

export const metadata: Metadata = { title: "Reseller" };

export default async function ResellerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ResellerDetailClient id={id} />;
}
