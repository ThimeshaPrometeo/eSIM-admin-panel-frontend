"use client";

import { useEffect, useId, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { damp } from "@/lib/design/motion";
import { UsageRing } from "./usage";
import { useReducedMotion } from "./motion/use-reduced-motion";

/**
 * The eSIM card (spec 7.5, signature element): a SIM-shaped card with a cut
 * corner and a fine-line chip contour, in dark glass with an Azure → Emerald
 * edge light, the QR code, the ICCID in Geist Mono and a usage ring.
 *
 * It tilts in 3D toward the cursor with weighted inertia and a moving specular
 * highlight, using CSS 3D transforms only (no WebGL). The loop runs only while
 * the card is moving and stops once it has settled. Reduced motion: static.
 *
 * The card is always dark glass (data-theme="dark"), also on light pages.
 */
export function EsimCard({
  iccid,
  planName,
  lpa,
  usedBytes,
  limitBytes,
  statusLabel,
  className,
  tilt = true,
}: {
  iccid: string;
  planName: string;
  /** Full LPA string, encoded in the QR (LPA:1$smdp$code). */
  lpa: string;
  usedBytes: number;
  limitBytes: number;
  statusLabel?: string;
  className?: string;
  tilt?: boolean;
}) {
  const reduced = useReducedMotion();
  const stage = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const shine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = stage.current;
    const el = card.current;
    const light = shine.current;
    if (!host || !el || !light || reduced || !tilt) return;

    const s = { x: 0, y: 0, tx: 0, ty: 0, glow: 0, tglow: 0 };
    let frame = 0;
    let last = 0;

    const render = () => {
      el.style.transform = `rotateX(${(-s.y * 9).toFixed(3)}deg) rotateY(${(s.x * 13).toFixed(3)}deg) translateZ(0)`;
      light.style.opacity = s.glow.toFixed(3);
      light.style.background = `radial-gradient(420px circle at ${(50 + s.x * 50).toFixed(1)}% ${(50 + s.y * 50).toFixed(1)}%, rgba(255,255,255,0.22), rgba(255,255,255,0.05) 35%, transparent 60%)`;
      el.style.setProperty("--edge-angle", `${(135 + s.x * 40).toFixed(1)}deg`);
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      s.x = damp(s.x, s.tx, 0.004, dt);
      s.y = damp(s.y, s.ty, 0.004, dt);
      s.glow = damp(s.glow, s.tglow, 0.01, dt);
      render();
      const settled = Math.abs(s.x - s.tx) < 0.001 && Math.abs(s.y - s.ty) < 0.001 && Math.abs(s.glow - s.tglow) < 0.005;
      frame = settled ? 0 : requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!frame) {
        last = performance.now();
        frame = requestAnimationFrame(loop);
      }
    };
    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      s.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      s.ty = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1));
      s.tglow = 1;
      kick();
    };
    const onLeave = () => {
      s.tx = 0;
      s.ty = 0;
      s.tglow = 0;
      kick();
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
    };
  }, [reduced, tilt]);

  // Cut corner: top-right, like a SIM card. Shared by the edge and the body.
  const cut = "polygon(0 0, calc(100% - 44px) 0, 100% 44px, 100% 100%, 0 100%)";
  const gb = (n: number) => `${(n / 1024 ** 3).toFixed(n < 10 * 1024 ** 3 ? 1 : 0)} GB`;

  return (
    <div ref={stage} className={cn("w-full max-w-[420px] [container-type:inline-size] [perspective:1100px]", className)} data-theme="dark">
      <div
        ref={card}
        className="relative aspect-[1.586] w-full [transform-style:preserve-3d] will-change-transform"
        style={{ ["--edge-angle" as string]: "135deg" }}
      >
        {/* edge light */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            clipPath: cut,
            background:
              "linear-gradient(var(--edge-angle), var(--primary) 0%, color-mix(in oklab, var(--primary) 15%, transparent) 30%, var(--border) 50%, color-mix(in oklab, var(--accent) 15%, transparent) 70%, var(--accent) 100%)",
          }}
        />
        {/* body */}
        <div
          className="absolute inset-px overflow-hidden"
          style={{
            clipPath: cut,
            background:
              "radial-gradient(120% 90% at 0% 0%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%), radial-gradient(90% 80% at 100% 100%, color-mix(in oklab, var(--accent) 16%, transparent), transparent 60%), linear-gradient(160deg, var(--surface-2) 0%, var(--surface-1) 55%, var(--bg) 100%)",
            boxShadow: "inset 0 1px 0 var(--highlight)",
          }}
        >
          {/* fine grid texture */}
          <div
            aria-hidden="true"
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(var(--border) 0.6px, transparent 0.6px)",
              backgroundSize: "10px 10px",
              maskImage: "linear-gradient(120deg, black, transparent 70%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-between p-[6%] text-fg">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-small text-fg-2">eSIM</p>
                <p className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.01em]">{planName}</p>
                {statusLabel ? (
                  <p className="mt-1.5 inline-flex items-center gap-1.5 text-small text-accent">
                    <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
                    {statusLabel}
                  </p>
                ) : null}
              </div>
              <UsageRing
                used={usedBytes}
                limit={limitBytes}
                size={64}
                stroke={5}
                label={
                  <span className="flex flex-col items-center leading-none">
                    <span className="text-[13px] font-semibold tabular">{Math.round((usedBytes / Math.max(1, limitBytes)) * 100)}%</span>
                    <span className="mt-1 text-[9px] text-fg-3">{gb(limitBytes)}</span>
                  </span>
                }
              />
            </div>

            <div className="flex items-end justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-3">
                <ChipContour />
                <div className="min-w-0">
                  <p className="text-[11px] text-fg-3">ICCID</p>
                  <p className="whitespace-nowrap font-mono tabular" style={{ fontSize: "clamp(10.5px, 3.55cqw, 15px)" }}>
                    {iccid.replace(/(.{4})(?!$)/g, "$1 ")}
                  </p>
                </div>
              </div>
              <div className="shrink-0 rounded-[10px] bg-white p-1.5 shadow-[0_0_24px_-4px_var(--primary-glow)] [transform:translateZ(18px)]">
                <QRCodeSVG value={lpa} size={72} level="M" bgColor="#ffffff" fgColor="#050a14" /* fixed: scanners need black on white */ title="Install QR code" />
              </div>
            </div>
          </div>
          {/* specular highlight */}
          <div ref={shine} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen" />
        </div>
      </div>
    </div>
  );
}

function ChipContour() {
  const id = useId();
  return (
    <svg width="46" height="36" viewBox="0 0 46 36" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="44.5" height="34.5" rx="7" style={{ stroke: "color-mix(in oklab, var(--text) 55%, transparent)" }} strokeWidth="1" />
      <path
        d="M0.75 12H14M0.75 24H14M32 12H45.25M32 24H45.25M14 0.75V35.25M32 0.75V35.25M14 18H32M23 0.75V9M23 27V35.25"
        style={{ stroke: "color-mix(in oklab, var(--text) 38%, transparent)" }}
        strokeWidth="0.8"
      />
      <rect x="14" y="9" width="18" height="18" rx="4" stroke={`url(#${id})`} strokeWidth="1" />
      <defs>
        <linearGradient id={id} x1="14" y1="9" x2="32" y2="27" gradientUnits="userSpaceOnUse">
          <stop style={{ stopColor: "var(--primary)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
    </svg>
  );
}
