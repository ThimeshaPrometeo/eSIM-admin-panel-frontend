import { AppShell } from "@/components/platform/app-shell";

/** Every workspace page renders inside the shell, which also guards the route (routes.md §5). */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
