"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Stats = { fps: number; low: number; frames: number };

/**
 * Development-only frame-rate meter (spec 7.9). Shows the rolling average
 * over the last 2 s and the 1% low (the 99th percentile frame time).
 * The latest stats are also on window.__fps for automated measurement.
 */
export function FpsMeter({ className }: { className?: string }) {
  const [stats, setStats] = useState<Stats>({ fps: 0, low: 0, frames: 0 });
  const times = useRef<number[]>([]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let lastPaint = last;
    let total = 0;
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      total++;
      times.current.push(dt);
      let sum = 0;
      for (const t of times.current) sum += t;
      while (sum > 2000 && times.current.length > 1) sum -= times.current.shift()!;
      if (now - lastPaint > 500) {
        lastPaint = now;
        const sorted = [...times.current].sort((a, b) => b - a);
        const p99 = sorted[Math.floor(sorted.length * 0.01)] ?? dt;
        const next = { fps: (times.current.length * 1000) / sum, low: 1000 / p99, frames: total };
        (window as unknown as { __fps?: Stats }).__fps = next;
        setStats(next);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const tone = stats.fps >= 55 ? "text-accent" : stats.fps >= 40 ? "text-warning" : "text-danger";
  return (
    <div
      className={cn("glass-pop flex items-center gap-3 whitespace-nowrap rounded-full px-3 py-1.5 font-mono text-small tabular sm:px-4", className)}
      role="status"
      aria-label={`Frame rate ${Math.round(stats.fps)} frames per second`}
    >
      <span className={cn("inline-flex items-center gap-1.5", tone)}>
        <span className="size-1.5 rounded-full bg-current shadow-[0_0_8px_currentColor]" />
        {stats.fps ? stats.fps.toFixed(0) : "–"} fps
      </span>
      <span className="hidden text-fg-3 sm:inline">1% low {stats.low ? stats.low.toFixed(0) : "–"}</span>
    </div>
  );
}
