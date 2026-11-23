import type { Metadata } from "next";
import { ComingSoon } from "@/components/platform/route-states";

export const metadata: Metadata = { title: "Profile and security" };

/** Profile and security (spec 8.30) comes after the demo. */
export default function ProfilePage() {
  return <ComingSoon title="Profile and security" />;
}
