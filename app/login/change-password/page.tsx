import type { Metadata } from "next";
import { ChangePasswordClient } from "./change-password-client";

export const metadata: Metadata = { title: "Set a new password" };

export default function ChangePasswordPage() {
  return <ChangePasswordClient />;
}
