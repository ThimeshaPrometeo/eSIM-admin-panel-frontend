/**
 * Demo IP addresses for the audit log, from the ranges reserved for
 * documentation (RFC 5737), so none is a real address. Stable per user.
 */
export function demoIp(userId: string | null) {
  if (!userId) return null;
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const tenant = userId === "u-admin" || userId === "u-support" || userId === "u-finance";
  return `${tenant ? "203.0.113" : "198.51.100"}.${(h % 200) + 20}`;
}
