import type { Metadata } from "next";
import { CoverageClient } from "./coverage-client";

export const metadata: Metadata = { title: "Coverage" };

export default function CoveragePage() {
  return <CoverageClient />;
}
