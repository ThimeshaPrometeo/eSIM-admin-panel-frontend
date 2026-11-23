import { cn } from "@/lib/utils";

/**
 * Ambient lighting (spec 7.4): two or three very soft, slowly drifting radial
 * lights behind the content. CSS only (no WebGL) so it is safe behind tables
 * and forms. Reduced motion stops the drift (globals.css).
 */
export function AmbientBackground({ className, fixed = true }: { className?: string; fixed?: boolean }) {
  return (
    <div aria-hidden="true" className={cn(fixed ? "fixed" : "absolute", "pointer-events-none inset-0 -z-10 overflow-hidden", className)}>
      <div
        className="absolute -left-[18%] -top-[22%] h-[70vmax] w-[70vmax] rounded-full blur-[40px]"
        style={{ background: "radial-gradient(closest-side, var(--ambient-azure), transparent)", animation: "drift-a 38s var(--ease-in-out) infinite" }}
      />
      <div
        className="absolute -bottom-[26%] -right-[16%] h-[64vmax] w-[64vmax] rounded-full blur-[40px]"
        style={{ background: "radial-gradient(closest-side, var(--ambient-emerald), transparent)", animation: "drift-b 46s var(--ease-in-out) infinite" }}
      />
      <div
        className="absolute left-[40%] top-[30%] h-[46vmax] w-[46vmax] rounded-full blur-[40px]"
        style={{ background: "radial-gradient(closest-side, var(--ambient-ink), transparent)", animation: "drift-c 54s var(--ease-in-out) infinite" }}
      />
    </div>
  );
}
