import type { Metadata } from "next";
import { CustomerDetailClient } from "./customer-detail-client";

export const metadata: Metadata = { title: "Customer" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CustomerDetailClient id={id} />;
}
