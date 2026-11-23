"use client";

import { PageHeader } from "@/components/platform/primitives";
import { usePlatform } from "@/contexts/platform-context";

export default function DashboardPage() {
  const { me } = usePlatform();
  return <PageHeader title={`Welcome, ${me?.fullName.split(" ")[0] ?? ""}`} description="The dashboard is built in the next phase." />;
}
