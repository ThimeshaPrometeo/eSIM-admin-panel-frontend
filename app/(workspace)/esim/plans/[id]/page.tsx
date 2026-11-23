import type { Metadata } from "next";
import { PlanDetailClient } from "./plan-detail-client";

export const metadata: Metadata = { title: "Plan" };

export default async function PlanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlanDetailClient id={id} />;
}
