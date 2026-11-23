import type { Metadata } from "next";
import { StaffRolesClient } from "./staff-roles-client";

export const metadata: Metadata = { title: "Staff roles" };

export default function Page() {
  return <StaffRolesClient />;
}
