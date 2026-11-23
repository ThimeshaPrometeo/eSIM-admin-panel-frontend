import type { Metadata } from "next";
import { ResellersClient } from "./resellers-client";

export const metadata: Metadata = { title: "Resellers" };

export default function ResellersPage() {
  return <ResellersClient />;
}
