import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DesignSystemClient } from "./design-system-client";

export const metadata: Metadata = { title: "Design system" };

// Development only (spec 6, 7.9). A production build serves it only when
// DESIGN_SYSTEM_PAGE=1 is set at build time (used for bundle measurement).
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production" && process.env.DESIGN_SYSTEM_PAGE !== "1") notFound();
  return <DesignSystemClient />;
}
