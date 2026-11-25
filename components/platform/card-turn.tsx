"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useReducedMotion } from "./motion/use-reduced-motion";

/**
 * One card with several faces. When `faceKey` changes, the card turns in 3D
 * around the Y axis to the new face; nothing else on the page re-renders.
 *
 *  - major: 650 ms, the old face turns away (0 → -90°) moving back in depth,
 *    the new one turns in (90° → 0) and settles forward. Forward turns left,
 *    back turns right. Weighted ease, no overshoot.
 *  - minor: a quicker, smaller turn for recovery ⇄ authenticator code.
 *  - none: swap at once (restoring a refresh).
 *  - reduced motion: a 150 ms crossfade, no rotation.
 *
 * Only transform and opacity animate on the faces (Web Animations, on the
 * compositor); the wrapper's height follows the faces so the layout around the
 * card never jumps. During a turn the glass blur is swapped for a plain
 * translucent fill (`data-turning`, see globals.css): backdrop-filter on a
 * rotating layer is costly and glitches in Safari. The face that isn't shown
 * is inert. When a turn ends, focus moves to the new face's first field and
 * the step is announced.
 */

export const TURN_EASE = "cubic-bezier(0.65, 0, 0.35, 1)";
const DURATION = { major: 650, minor: 380, reduced: 150, exit: 400 } as const;

type Turn = { kind: "major" | "minor" | "none"; dir: 1 | -1 };
type Faces = { current: string; leaving: string | null; turn: Turn; seq: number };

export function CardTurn({
  ref,
  faceKey,
  turn,
  render,
  announce,
  focusOnMount,
  exiting,
  onExited,
}: {
  /** The wrapper (the globe's signal lands on it). */
  ref?: RefObject<HTMLElement | null>;
  faceKey: string;
  turn: Turn;
  render: (key: string) => ReactNode;
  /** What the live region says when a face settles. */
  announce: (key: string) => string;
  /** Focus the first field on first render too (a refresh on a later step). */
  focusOnMount?: boolean;
  /** Fade and scale the card away, then call `onExited`. */
  exiting?: boolean;
  onExited?: () => void;
}) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const faceEls = useRef(new Map<string, HTMLDivElement>());
  const [faces, setFaces] = useState<Faces>({ current: faceKey, leaving: null, turn, seq: 0 });
  const [message, setMessage] = useState("");
  const settling = useRef<string | null>(null);

  // a new face: keep the old one mounted (its state too) until the turn ends
  if (faceKey !== faces.current) {
    setFaces({ current: faceKey, leaving: turn.kind === "none" ? null : faces.current, turn, seq: faces.seq + 1 });
  }

  const focusFace = (key: string) => {
    const el = faceEls.current.get(key);
    const target = el?.querySelector<HTMLElement>("[data-autofocus], input:not([disabled]):not([type=hidden]), textarea, select, button:not([disabled])");
    target?.focus({ preventScroll: true });
  };
  const settle = (key: string) => {
    focusFace(key);
    setMessage(announce(key));
  };

  useEffect(() => {
    if (focusOnMount) focusFace(faces.current);
    // first render only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (faces.seq === 0) return;
    const { current, leaving, turn: t } = faces;
    const wrap = box.current;
    const into = faceEls.current.get(current);
    if (!leaving || !wrap || !into) {
      settle(current);
      return;
    }
    if (typeof wrap.animate !== "function") {
      // no Web Animations (old browser, tests): swap at once
      settling.current = current;
      setFaces((f) => ({ ...f, leaving: null }));
      return;
    }
    const from = faceEls.current.get(leaving);
    const h0 = from?.offsetHeight ?? wrap.offsetHeight;
    const h1 = into.offsetHeight;
    const kind = reduced ? "reduced" : t.kind === "minor" ? "minor" : "major";
    const duration = DURATION[kind];
    const timing: KeyframeAnimationOptions = { duration, easing: TURN_EASE, fill: "both" };

    wrap.dataset.turning = "";
    wrap.style.height = `${h1}px`;
    for (const el of [from, into]) if (el) el.style.willChange = "transform, opacity";

    const anims: Animation[] = [wrap.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration, easing: TURN_EASE })];
    const d = t.dir;
    if (kind === "reduced") {
      if (from) anims.push(from.animate([{ opacity: 1 }, { opacity: 0 }], timing));
      anims.push(into.animate([{ opacity: 0 }, { opacity: 1 }], timing));
    } else if (kind === "minor") {
      // a soft, small turn inside the same card: 18° and a crossfade
      if (from)
        anims.push(
          from.animate(
            [
              { transform: "translate3d(0,0,0) rotateY(0deg)", opacity: 1 },
              { transform: `translate3d(0,0,-24px) rotateY(${-18 * d}deg)`, opacity: 0, offset: 0.5 },
              { transform: `translate3d(0,0,-24px) rotateY(${-18 * d}deg)`, opacity: 0 },
            ],
            timing,
          ),
        );
      anims.push(
        into.animate(
          [
            { transform: `translate3d(0,0,-24px) rotateY(${18 * d}deg)`, opacity: 0 },
            { transform: `translate3d(0,0,-24px) rotateY(${18 * d}deg)`, opacity: 0, offset: 0.4 },
            { transform: "translate3d(0,0,0) rotateY(0deg)", opacity: 1 },
          ],
          timing,
        ),
      );
    } else {
      // one continuous half turn: the old face goes edge-on at the midpoint, the new one comes in from there
      if (from)
        anims.push(
          from.animate(
            [
              { transform: "translate3d(0,0,0) rotateY(0deg)", opacity: 1 },
              { transform: `translate3d(0,0,-90px) rotateY(${-90 * d}deg)`, opacity: 0.55, offset: 0.5 },
              { transform: `translate3d(0,0,-90px) rotateY(${-90 * d}deg)`, opacity: 0 },
            ],
            timing,
          ),
        );
      anims.push(
        into.animate(
          [
            { transform: `translate3d(0,0,-90px) rotateY(${90 * d}deg)`, opacity: 0 },
            { transform: `translate3d(0,0,-90px) rotateY(${90 * d}deg)`, opacity: 0.55, offset: 0.5 },
            { transform: "translate3d(0,0,0) rotateY(0deg)", opacity: 1 },
          ],
          timing,
        ),
      );
    }

    // the new face may still grow (e.g. a QR code loading): follow it
    const ro = new ResizeObserver(() => {
      const h = into.offsetHeight;
      if (Math.abs(h - parseFloat(wrap.style.height)) < 1) return;
      const now = wrap.getBoundingClientRect().height;
      wrap.style.height = `${h}px`;
      wrap.animate([{ height: `${now}px` }, { height: `${h}px` }], { duration: 200, easing: TURN_EASE });
    });
    ro.observe(into);

    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      ro.disconnect();
      // the new face's end state is its resting state: dropping its animation changes nothing on screen.
      // The old face keeps its last frame (hidden) until React removes it.
      anims[anims.length - 1]!.cancel();
      settling.current = current;
      setFaces((f) => (f.leaving === leaving && f.current === current ? { ...f, leaving: null } : f));
    };
    void anims[anims.length - 1]!.finished.then(end, () => {});
    return () => {
      ro.disconnect();
      // superseded by a newer turn: finish this one at once
      if (!done) end();
    };
    // runs once per face change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces.seq]);

  // after the turn, once the new face is back in the flow: let the height follow it again, restore the glass, focus
  useLayoutEffect(() => {
    const key = settling.current;
    if (faces.leaving || !key || key !== faces.current) return;
    settling.current = null;
    const wrap = box.current;
    if (wrap) {
      wrap.style.height = "";
      delete wrap.dataset.turning;
    }
    const el = faceEls.current.get(key);
    if (el) el.style.willChange = "";
    settle(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faces.leaving, faces.current]);

  // leaving the card: fade and scale down slightly, then hand off
  useEffect(() => {
    const wrap = box.current;
    if (!exiting || !wrap) return;
    if (typeof wrap.animate !== "function") {
      onExited?.();
      return;
    }
    wrap.dataset.turning = "";
    const a = wrap.animate(
      [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: reduced ? "scale(1)" : "scale(0.96)" },
      ],
      { duration: reduced ? DURATION.reduced : DURATION.exit, easing: TURN_EASE, fill: "forwards" },
    );
    let cancelled = false;
    void a.finished.then(() => !cancelled && onExited?.(), () => {});
    return () => {
      cancelled = true;
    };
  }, [exiting, reduced, onExited]);

  const keys = faces.leaving ? [faces.leaving, faces.current] : [faces.current];
  return (
    <div ref={ref as RefObject<HTMLDivElement | null> | undefined} className="si-turn relative">
      <div ref={box} className="si-turn-box relative [perspective:1200px] [transform-style:preserve-3d]">
        {keys.map((key) => {
          const active = key === faces.current;
          const turning = !!faces.leaving;
          return (
            <div
              key={key}
              ref={(el) => {
                if (el) faceEls.current.set(key, el);
                else faceEls.current.delete(key);
              }}
              data-face={key}
              data-active={active ? "" : undefined}
              // only the face on show is in the accessibility tree; both are inert mid-turn
              inert={!active || turning}
              aria-hidden={!active || undefined}
              className={
                turning
                  ? "si-face absolute inset-x-0 top-0 [backface-visibility:hidden] [transform-style:preserve-3d]"
                  : "si-face relative [backface-visibility:hidden]"
              }
            >
              {render(key)}
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite" role="status">
        {message}
      </p>
    </div>
  );
}
