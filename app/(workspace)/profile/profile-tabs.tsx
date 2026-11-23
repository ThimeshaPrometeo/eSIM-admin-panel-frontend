"use client";

import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Profile | Security, for everyone (admins and staff reach them from the account menu). */
export function ProfileTabs() {
  const path = usePathname();
  const router = useRouter();
  return (
    <Tabs value={path.startsWith("/profile/security") ? "security" : "profile"} onValueChange={(v) => router.push(v === "security" ? "/profile/security" : "/profile")}>
      <TabsList className="self-start">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
