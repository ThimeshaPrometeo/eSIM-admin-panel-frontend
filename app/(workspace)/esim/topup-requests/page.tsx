import type { Metadata } from "next";
import { TopupRequestsClient } from "./topup-requests-client";

export const metadata: Metadata = { title: "Top-up requests" };

export default function Page() {
  return <TopupRequestsClient />;
}
