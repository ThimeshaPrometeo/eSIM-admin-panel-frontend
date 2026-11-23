import type { Metadata } from "next";
import { EsimDetailClient } from "./esim-detail-client";

export const metadata: Metadata = { title: "eSIM" };

export default async function EsimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EsimDetailClient id={id} />;
}
