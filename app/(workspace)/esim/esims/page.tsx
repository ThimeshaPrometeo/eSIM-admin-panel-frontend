import type { Metadata } from "next";
import { EsimsClient } from "./esims-client";

export const metadata: Metadata = { title: "eSIMs" };

export default function EsimsPage() {
  return <EsimsClient />;
}
