"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Fingerprint, Gauge, Globe2, Lock, RadioTower, ShieldCheck, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { damp } from "@/lib/design/motion";
import { activityFlag, activityText, type ActivityEvent } from "@/lib/platform/activity";
import { LogoMark } from "./logo-mark";
import { CountUp } from "./motion/count-up";
import { OtpInput, type OtpInputHandle } from "./otp-input";
import { useReducedMotion } from "./motion/use-reduced-motion";
import { LiveGlobe } from "./three/lazy";

/*
 * All copy lives here, in one place. Rule: never show a certification, a
 * figure or a status that is not true or does not come from our data. The
 * country count and the globe events are passed in from the data layer; the
 * system status shows only when the backend health check reports it.
 */
export const SIGN_IN_COPY = {
  live: { label: "Live", text: (countries: number) => `Real-time usage across ${countries} countries` },
  headline: ["Sell eSIMs.", "See every megabyte."] as const,
  sub: "Sell travel eSIMs, manage your resellers and follow data usage in real time, from one secure workspace.",
  stats: {
    countries: "countries covered",
    networks: { value: "4G · 5G", label: "high-speed networks" },
    billing: { value: "Per MB", label: "pay only for data used" },
  },
  card: {
    title: "Sign in to your workspace",
    sub: "For admins, resellers and team members",
    user: "Username or email",
    userPlaceholder: "name@company.com",
    password: "Password",
    forgot: "Forgot password?",
    submit: "Sign in",
    or: "or",
    passkey: "Sign in with a passkey",
    footnote: "Protected with two-factor authentication",
    helper: "New reseller or team member? Ask your administrator for access.",
  },
  twoFactor: {
    title: "Check your authenticator",
    sub: "Enter the 6-digit code from your authenticator app.",
    code: "6-digit code",
    locked: (minutes: number) => `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    useRecovery: "Use a recovery code instead",
    recoveryTitle: "Use a recovery code",
    recoverySub: "Enter one of the recovery codes you saved when you set up two-factor authentication.",
    recovery: "Recovery code",
    useApp: "Use your authenticator app instead",
    submit: "Verify and continue",
    back: "Back to sign in",
  },
  changePassword: {
    title: "Set a new password",
    sub: "This is your first sign-in. Choose a password only you know.",
    current: "Current password",
    next: "New password",
    nextHint: "At least 10 characters.",
    confirm: "Confirm new password",
    mismatch: "The two passwords don't match.",
    submit: "Save and continue",
  },
  status: "All systems operational",
} as const;

/** Major hubs [lat, lon] and the routes between them. */
const HUBS: [number, number][] = [
  [51.51, -0.13], // London
  [25.2, 55.27], // Dubai
  [35.68, 139.69], // Tokyo
  [40.71, -74.0], // New York
  [-23.55, -46.63], // São Paulo
  [19.08, 72.88], // Mumbai
];
const [LON, DXB, TYO, NYC, GRU, BOM] = HUBS as [[number, number], [number, number], [number, number], [number, number], [number, number], [number, number]];
const ROUTES = [
  { from: LON, to: NYC },
  { from: LON, to: DXB },
  { from: DXB, to: BOM },
  { from: BOM, to: TYO },
  { from: DXB, to: TYO },
  { from: NYC, to: GRU },
  { from: LON, to: GRU },
];
const GLOBE_TOKENS = { primary: "si-blue", accent: "si-globe-dot", bg: "si-bg", "surface-1": "si-bg-raised", "surface-2": "si-bg-raised", "surface-3": "si-bg-raised" };

/** Every few seconds a signal travels from a city into the sign-in card. */
const SIGNAL_EVERY_MS = 4600;
const SIGNAL_TRAVEL_MS = 1150;

export type SignInValues = { username: string; password: string };
export type TwoFactorValues = { code: string; method: "totp" | "recovery" };
export type ChangePasswordValues = { currentPassword: string; newPassword: string };
type Projection = { x: number; y: number; visible: boolean };

/**
 * The sign-in page. Copy and the sign-in card on the left; the live globe on
 * the right with an orbit, event chips, and a signal that flows from a city
 * into the card. Below 1024px the globe moves behind the content at 40% and a
 * slim live ticker replaces the chips. Follows the app theme (dark or light).
 *
 * Brand: the logo mark only, until tenant settings (white-label) supply a name
 * and logo. `embedded` sizes it to its container (design-system page).
 */
const CardRefContext = createContext<RefObject<HTMLElement | null> | undefined>(undefined);
/** The card's ref (the signal from the globe lands on it); undefined inside a `CardTurn`, whose wrapper takes it. */
export function useCardRef() {
  return useContext(CardRefContext);
}
/** Faces inside a turning card: the wrapper holds the card ref, not each face. */
export function DetachedCardRef({ children }: { children: ReactNode }) {
  return <CardRefContext.Provider value={undefined}>{children}</CardRefContext.Provider>;
}

export function SignInView({
  countryCount,
  events,
  onSubmit,
  onPasskey,
  forgotHref = "/forgot-password",
  systemStatus,
  busy,
  error,
  notice,
  embedded,
  card: customCard,
  tall,
  leaving,
}: {
  /** Countries with at least one priced network, from the network data. */
  countryCount: number;
  /** Recent events from the data layer (demo events in demo mode). */
  events: readonly ActivityEvent[];
  onSubmit?: (values: SignInValues) => void | boolean | Promise<void | boolean>;
  onPasskey?: () => void;
  forgotHref?: string;
  /** From the backend health check; nothing is shown when absent. */
  systemStatus?: "operational" | null;
  busy?: boolean;
  error?: string | null;
  notice?: ReactNode;
  embedded?: boolean;
  /** Another card on the same page (forgot or reset password, 2FA set-up); it gets the card ref from `useCardRef`. */
  card?: ReactNode;
  /** A taller card: hides the sub-copy and stats to make room. */
  tall?: boolean;
  /** Signed in: the ambient light brightens while the card hands off to the workspace. */
  leaving?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const globeHost = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);
  const projection = useRef<Projection[]>([]);

  const onArrive = useCallback(() => {
    const el = card.current;
    if (el) {
      el.removeAttribute("data-flash");
      void el.offsetWidth; // restart the flash animation
      el.setAttribute("data-flash", "on");
    }
  }, []);

  return (
    <div
      ref={root}
      data-leaving={leaving ? "" : undefined}
      className={cn("signin relative isolate flex flex-col overflow-hidden", embedded ? "min-h-[960px]" : "min-h-dvh fit:h-dvh fit:min-h-0")}
    >
      <Backdrop />
      <GlobeStage hostRef={globeHost} projectionRef={projection} events={events} />
      <SignalOverlay rootRef={root} globeRef={globeHost} cardRef={card} projectionRef={projection} onArrive={onArrive} />

      <LiveTicker events={events} />
      <TopBar />

      <main className="relative z-10 flex min-h-0 flex-1 items-center px-6 py-8 sm:px-10 lg:px-16 lg:py-4 short:py-2">
        <div className="flex w-full max-w-[520px] flex-col gap-6 short:gap-3 tiny:gap-2.5 max-lg:mx-auto">
          <div className="si-enter" style={{ "--i": 1 } as CSSProperties}>
            <LiveBadge countryCount={countryCount} />
          </div>

          <div className="flex flex-col gap-5 short:gap-3">
            <Headline />
            <p className={cn("si-enter max-w-[46ch] text-[18px] leading-[1.6] text-[var(--si-fg-muted)] short:text-[16px] short:leading-[1.5] tiny:hidden", tall && "hidden")} style={{ "--i": 4 } as CSSProperties}>
              {SIGN_IN_COPY.sub}
            </p>
          </div>

          <div className={cn("si-enter mini:hidden", tall && "hidden")} style={{ "--i": 5 } as CSSProperties}>
            <StatsStrip countryCount={countryCount} />
          </div>

          <div className="si-enter" style={{ "--i": 6 } as CSSProperties}>
            {customCard ? (
              <CardRefContext.Provider value={card}>{customCard}</CardRefContext.Provider>
            ) : (
              <SignInCard ref={card} onSubmit={onSubmit} onPasskey={onPasskey} forgotHref={forgotHref} busy={busy} error={error} notice={notice} />
            )}
          </div>
        </div>
      </main>

      <Footer systemStatus={systemStatus} />
    </div>
  );
}
// ---------------------------------------------------------------- backdrop --

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* large radial glow behind the globe */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(55% 60% at 74% 50%, var(--si-glow-blue), transparent 70%)" }} />
      {/* faint teal glow, bottom left */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(40% 45% at 0% 100%, var(--si-glow-teal), transparent 70%)" }} />
      {/* slow aurora across the top (teal and violet, very faint) */}
      <div className="si-aurora absolute -top-[28%] left-[-10%] h-[62%] w-[120%] blur-[60px]">
        <div className="absolute inset-0" style={{ background: "radial-gradient(40% 55% at 30% 60%, var(--si-aurora-teal), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(38% 50% at 68% 45%, var(--si-aurora-violet), transparent 70%)" }} />
      </div>
      <div className="si-dot-grid absolute inset-0" />
      <div className="film-grain absolute inset-0" />
      <div className="absolute inset-0" style={{ background: "radial-gradient(130% 100% at 50% 45%, transparent 60%, var(--si-vignette) 100%)" }} />
      {/* brightens while the card hands off to the workspace */}
      <div className="si-exit-light absolute inset-0" />
    </div>
  );
}

// ------------------------------------------------------------------- globe --

function GlobeStage({
  hostRef,
  projectionRef,
  events,
}: {
  hostRef: RefObject<HTMLDivElement | null>;
  projectionRef: RefObject<Projection[]>;
  events: readonly ActivityEvent[];
}) {
  const reduced = useReducedMotion();
  const globe = useRef<HTMLDivElement>(null);
  const cards = useRef<HTMLDivElement>(null);

  // Light parallax: globe 6–8px, cards 10px the other way, with weighted inertia.
  useEffect(() => {
    if (reduced) return;
    const s = { x: 0, y: 0, tx: 0, ty: 0 };
    let frame = 0;
    let last = performance.now();
    const onMove = (e: PointerEvent) => {
      s.tx = (e.clientX / window.innerWidth) * 2 - 1;
      s.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      s.x = damp(s.x, s.tx, 0.02, dt);
      s.y = damp(s.y, s.ty, 0.02, dt);
      if (globe.current) globe.current.style.transform = `translate3d(${(s.x * 8).toFixed(2)}px, ${(s.y * 6).toFixed(2)}px, 0)`;
      if (cards.current) cards.current.style.transform = `translate3d(${(s.x * -10).toFixed(2)}px, ${(s.y * -8).toFixed(2)}px, 0)`;
      frame = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", onMove);
    frame = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, [reduced]);

  return (
    <div
      className={cn(
        // below 1024px: behind the content at 40%, anchored bottom right, not interactive
        "pointer-events-none absolute -bottom-[18%] -right-[32%] aspect-square w-[130vw] max-w-[860px] opacity-40",
        // desktop: on the right, vertically centred, draggable
        "lg:pointer-events-auto lg:bottom-auto lg:right-[-3%] lg:top-1/2 lg:w-[min(56vw,1080px)] lg:max-w-none lg:-translate-y-1/2 lg:opacity-100 2xl:right-[2%]",
      )}
    >
      <div className="si-globe-enter absolute inset-0">
        <div ref={globe} className="absolute inset-0 will-change-transform">
          <div ref={hostRef} className="absolute inset-0">
            <LiveGlobe
              mode="hero"
              landTone="all"
              oceanDots
              orbit
              routes={ROUTES}
              pins={HUBS}
              trackPoints={HUBS}
              projectionRef={projectionRef}
              spin={0.12}
              draggable
              tokens={GLOBE_TOKENS}
              initialView={[24, 30]}
            />
          </div>
        </div>
        <div ref={cards} aria-hidden="true" className="pointer-events-none absolute inset-0 hidden will-change-transform lg:block">
          <TelemetryCards events={events} />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------- signal into the login --

/**
 * Every few seconds a thin line of light travels from a city on the globe
 * into the top border of the sign-in card; on arrival the card's top edge
 * flashes and the live counter goes up by one. Desktop only (the globe is
 * behind the content below 1024px), drawn with transform-free SVG updates.
 * Reduced motion: no line; the counter still ticks.
 */
function SignalOverlay({
  rootRef,
  globeRef,
  cardRef,
  projectionRef,
  onArrive,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  globeRef: RefObject<HTMLDivElement | null>;
  cardRef: RefObject<HTMLElement | null>;
  projectionRef: RefObject<Projection[]>;
  onArrive: () => void;
}) {
  const reduced = useReducedMotion();
  const svg = useRef<SVGSVGElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const beam = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const spark = useRef<SVGCircleElement>(null);
  const grad = useRef<SVGLinearGradientElement>(null);
  const gid = useId().replace(/:/g, "");

  useEffect(() => {
    let frame = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const desktop = window.matchMedia("(min-width: 1024px)");

    const hide = () => {
      for (const el of [trail.current, beam.current, glow.current, spark.current]) el?.setAttribute("opacity", "0");
    };

    const fire = () => {
      timer = setTimeout(fire, SIGNAL_EVERY_MS);
      if (document.visibilityState !== "visible") return;
      const rootEl = rootRef.current;
      const globeEl = globeRef.current;
      const cardEl = cardRef.current;
      if (reduced || !desktop.matches || !rootEl || !globeEl || !cardEl) {
        onArrive();
        return;
      }
      const rr = rootEl.getBoundingClientRect();
      const gr = globeEl.getBoundingClientRect();
      // cities on the near side, preferably to the right of the card
      const cr0 = cardEl.getBoundingClientRect();
      const options = projectionRef.current
        .map((p, i) => ({ ...p, i, px: gr.left + p.x, py: gr.top + p.y }))
        .filter((p) => p.visible && p.px > cr0.right + 40 && p.py > rr.top + 40 && p.py < rr.bottom - 40);
      if (!options.length) {
        onArrive();
        return;
      }
      const pick = options[Math.floor(Math.random() * options.length)]!;
      const start = performance.now();

      const step = (now: number) => {
        const t = Math.min(1, (now - start) / SIGNAL_TRAVEL_MS);
        const g = globeEl.getBoundingClientRect();
        const r = rootEl.getBoundingClientRect();
        const c = cardEl.getBoundingClientRect();
        const p = projectionRef.current[pick.i] ?? pick;
        const sx = g.left + p.x - r.left;
        const sy = g.top + p.y - r.top;
        const ex = c.right - r.left - 56; // lands on the card's top border, near the right
        const ey = c.top - r.top;
        const cx = (sx + ex) / 2;
        const cy = Math.min(sy, ey) - 90;
        const d = `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
        const len = beam.current?.getTotalLength() || 600;
        const seg = Math.min(160, len * 0.28);
        // ease in-out along the path
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        for (const el of [trail.current, beam.current, glow.current]) el?.setAttribute("d", d);
        grad.current?.setAttribute("x1", String(sx));
        grad.current?.setAttribute("y1", String(sy));
        grad.current?.setAttribute("x2", String(ex));
        grad.current?.setAttribute("y2", String(ey));
        const offset = seg - e * (len + seg);
        for (const el of [beam.current, glow.current]) {
          el?.setAttribute("stroke-dasharray", `${seg} ${len + seg}`);
          el?.setAttribute("stroke-dashoffset", String(offset));
          el?.setAttribute("opacity", "1");
        }
        trail.current?.setAttribute("opacity", String(0.22 * Math.sin(Math.PI * t)));
        spark.current?.setAttribute("cx", String(sx));
        spark.current?.setAttribute("cy", String(sy));
        spark.current?.setAttribute("r", String(3 + 10 * t));
        spark.current?.setAttribute("opacity", String(Math.max(0, 0.9 - t * 1.6)));
        if (t < 1) frame = requestAnimationFrame(step);
        else {
          hide();
          onArrive();
        }
      };
      frame = requestAnimationFrame(step);
    };

    hide();
    timer = setTimeout(fire, 2600); // after the entrance
    return () => {
      if (timer) clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [reduced, rootRef, globeRef, cardRef, projectionRef, onArrive]);

  return (
    <svg ref={svg} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible lg:block">
      <defs>
        <linearGradient id={`${gid}-g`} ref={grad} gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--si-teal)" }} />
          <stop offset="1" style={{ stopColor: "var(--si-blue)" }} />
        </linearGradient>
        <filter id={`${gid}-blur`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path ref={trail} fill="none" stroke={`url(#${gid}-g)`} strokeWidth="1" opacity="0" />
      <path ref={glow} fill="none" stroke={`url(#${gid}-g)`} strokeWidth="5" strokeLinecap="round" filter={`url(#${gid}-blur)`} opacity="0" />
      <path ref={beam} fill="none" stroke={`url(#${gid}-g)`} strokeWidth="1.5" strokeLinecap="round" opacity="0" />
      <circle ref={spark} fill="none" style={{ stroke: "var(--si-teal)" }} strokeWidth="1" opacity="0" />
    </svg>
  );
}

// ------------------------------------------------------------- event chips --

type Slot = { cur: { id: number; item: ActivityEvent }; prev: { id: number; item: ActivityEvent } | null };

/** Three slots around the globe; one is replaced at a time (old fades out, new fades in). */
function TelemetryCards({ events }: { events: readonly ActivityEvent[] }) {
  const reduced = useReducedMotion();
  const [slots, setSlots] = useState<Slot[]>(() =>
    events.length ? [0, 1, 2].slice(0, events.length).map((i) => ({ cur: { id: i, item: events[i]! }, prev: null })) : [],
  );
  const counter = useRef(3);
  const turn = useRef(0);

  useEffect(() => {
    if (reduced || events.length <= slots.length) return;
    const t = setInterval(() => {
      const slotIndex = turn.current % 3;
      turn.current++;
      const id = counter.current++;
      setSlots((s) => s.map((slot, i) => (i === slotIndex ? { prev: slot.cur, cur: { id, item: events[id % events.length]! } } : slot)));
      setTimeout(() => setSlots((s) => s.map((slot, i) => (i === slotIndex ? { ...slot, prev: null } : slot))), 520);
    }, 2800);
    return () => clearInterval(t);
  }, [reduced, events, slots.length]);

  const places = ["left-[6%] top-[16%]", "right-[8%] top-[44%]", "bottom-[15%] left-[12%]"];
  const drift = ["8s", "10s", "12s"];
  const enterDelay = [1100, 1300, 1500];
  return (
    <>
      {slots.map((slot, i) => (
        <div key={i} className={cn("si-drift absolute", places[i])} style={{ "--drift": drift[i] } as CSSProperties}>
          <div className="relative">
            {slot.prev ? (
              <div key={`p${slot.prev.id}`} className="si-tele-out absolute left-0 top-0">
                <TelemetryCard item={slot.prev.item} />
              </div>
            ) : null}
            <div key={`c${slot.cur.id}`} className="si-tele-in" style={{ animationDelay: slot.cur.id < 3 ? `${enterDelay[i]}ms` : "120ms" }}>
              <TelemetryCard item={slot.cur.item} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function TelemetryCard({ item }: { item: ActivityEvent }) {
  const fresh = item.kind === "installed" || item.kind === "activated";
  return (
    <div className="si-glass flex items-center gap-2.5 whitespace-nowrap rounded-[12px] px-3.5 py-2.5 font-mono text-[12.5px] tabular shadow-[inset_0_1px_0_var(--si-highlight),0_18px_40px_-18px_var(--si-chip-shadow)]">
      <span className="text-[14px] leading-none">{activityFlag(item)}</span>
      <span className="text-[var(--si-fg)]">{activityText(item)}</span>
      {fresh ? <span className="si-live-dot ml-1 !size-1.5" /> : null}
    </div>
  );
}

/** Phones and tablets: a slim live ticker instead of the event chips. */
function LiveTicker({ events }: { events: readonly ActivityEvent[] }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced || events.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % events.length), 3200);
    return () => clearInterval(t);
  }, [reduced, events.length]);
  const a = events[i % Math.max(1, events.length)];
  if (!a) return null;
  return (
    <div className="relative z-10 flex h-9 items-center justify-center gap-2.5 border-b border-[var(--si-hairline)] bg-[color-mix(in_oklch,var(--si-card)_55%,transparent)] px-4 font-mono text-[12px] backdrop-blur-xl lg:hidden" role="status" aria-live="polite">
      <span className="si-live-dot !size-1.5" aria-hidden="true" />
      <span className="font-semibold tracking-[0.06em] text-[var(--si-live-text)]">{SIGN_IN_COPY.live.label.toUpperCase()}</span>
      <span key={a.id + i} className="si-tele-in truncate text-[var(--si-fg-muted)]">
        {activityFlag(a)} {activityText(a)}
      </span>
    </div>
  );
}
// ---------------------------------------------------------------- headline --

/** Line by line, each word sliding up from a soft blur; the second line in the gradient with a glow and a slow shimmer. */
function Headline() {
  const [first, second] = SIGN_IN_COPY.headline;
  const line2 = useRef<HTMLSpanElement>(null);

  // One gradient across the whole gradient line: tell each word the line width and its offset.
  useLayoutEffect(() => {
    const el = line2.current;
    if (!el) return;
    const measure = () => {
      el.style.setProperty("--line-w", `${el.offsetWidth}px`);
      el.querySelectorAll<HTMLElement>(".si-word").forEach((w) => w.style.setProperty("--word-x", `${w.offsetLeft}px`));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const words1 = first.split(" ");
  const words2 = second.split(" ");
  const base = 240;
  const step = 90;
  return (
    <h1
      className="text-[32px] font-[580] leading-[1.02] tracking-[-0.04em] sm:text-[clamp(40px,3.5vw,54px)] short:text-[clamp(38px,5.4vh,52px)]"
      aria-label={`${first} ${second}`}
    >
      <span className="block whitespace-nowrap" aria-hidden="true">
        {words1.map((w, i) => (
          <span key={i} className="si-word" style={{ "--d": `${base + i * step}ms` } as CSSProperties}>
            {w}
            {i < words1.length - 1 ? " " : ""}
          </span>
        ))}
      </span>
      <span className="relative block whitespace-nowrap" aria-hidden="true">
        {/* soft glow behind the gradient line */}
        <span className="si-gradient-text si-enter pointer-events-none absolute inset-0 select-none opacity-45 blur-2xl" style={{ "--i": 8 } as CSSProperties}>
          {second}
        </span>
        <span ref={line2} className="si-line-gradient relative inline-block">
          {words2.map((w, i) => (
            <span key={i} className="si-word" style={{ "--d": `${base + (words1.length + i) * step + 120}ms` } as CSSProperties}>
              {w}
              {i < words2.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </span>
    </h1>
  );
}

function LiveBadge({ countryCount }: { countryCount: number }) {
  return (
    <span className="si-glass inline-flex h-8 max-w-full items-center gap-2.5 whitespace-nowrap rounded-full px-3.5 text-[12px] text-[var(--si-fg-muted)] sm:text-[13px]">
      <span className="si-live-dot shrink-0" aria-hidden="true" />
      <span className="font-mono font-semibold uppercase tracking-[0.08em] text-[var(--si-live-text)]">{SIGN_IN_COPY.live.label}</span>
      <span aria-hidden="true" className="text-[var(--si-fg-subtle)]">
        ·
      </span>
      <span className="truncate">{SIGN_IN_COPY.live.text(countryCount)}</span>
    </span>
  );
}

function StatsStrip({ countryCount }: { countryCount: number }) {
  const s = SIGN_IN_COPY.stats;
  const items: { key: string; icon: ReactNode; value: ReactNode; label: string }[] = [
    { key: "countries", icon: <Globe2 strokeWidth={1.75} />, value: <CountUp value={countryCount} duration={1400} format={(n) => Math.round(n).toLocaleString("en-US")} />, label: s.countries },
    { key: "networks", icon: <RadioTower strokeWidth={1.75} />, value: s.networks.value, label: s.networks.label },
    { key: "billing", icon: <Gauge strokeWidth={1.75} />, value: s.billing.value, label: s.billing.label },
  ];
  return (
    <ul className="si-glass grid grid-cols-3 rounded-[16px] p-1.5" aria-label="Coverage">
      {items.map((it, i) => (
        <li key={it.key} className="relative min-w-0">
          {i > 0 ? <span aria-hidden="true" className="absolute inset-y-3 left-0 w-px bg-[var(--si-hairline)]" /> : null}
          <div className="si-strip-item flex min-h-14 items-center gap-3 rounded-[12px] px-3 py-2 short:min-h-12 short:py-1.5 max-sm:flex-col max-sm:items-start max-sm:gap-2">
            <span className="contents short:hidden">
              <IconTile>{it.icon}</IconTile>
            </span>
            <div className="min-w-0 leading-tight">
              <p className="whitespace-nowrap font-mono text-[15px] font-semibold tabular">{it.value}</p>
              <p className="text-[12px] text-[var(--si-fg-muted)] short:whitespace-nowrap">{it.label}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
function IconTile({ children }: { children: ReactNode }) {
  return (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-[9px] text-[var(--si-teal)] [&_svg]:size-4"
      style={{
        background: "linear-gradient(135deg, oklch(0.65 0.2 250 / 0.22), oklch(0.8 0.15 170 / 0.18))",
        boxShadow: "inset 0 0 0 1px var(--si-hairline), inset 0 1px 0 var(--si-highlight)",
      }}
    >
      {children}
    </span>
  );
}

// -------------------------------------------------------------------- card --

export const labelClass = "text-[13px] font-medium text-[var(--si-fg-muted)]";
export const linkClass =
  "si-hit rounded text-[13px] font-medium text-[var(--si-link)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--si-blue)]";

export function CardShell({
  ref,
  title,
  sub,
  onSubmit,
  busy,
  children,
}: {
  ref?: RefObject<HTMLElement | null>;
  title: string;
  sub: string;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <form ref={ref as RefObject<HTMLFormElement | null> | undefined} onSubmit={onSubmit} className="si-glass si-card w-full p-6 sm:p-8 short:p-6 tiny:px-6 tiny:py-5" aria-labelledby={`${id}-title`} aria-busy={busy || undefined} noValidate>
      <h2 id={`${id}-title`} className="text-[20px] font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      <p className="mt-1 text-[14px] text-[var(--si-fg-muted)]">{sub}</p>
      {children}
    </form>
  );
}

/** The password face. On success the password is cleared from state at once: no later step keeps it. */
export function SignInCard({
  ref,
  onSubmit,
  onPasskey,
  forgotHref = "/forgot-password",
  busy,
  error,
  notice,
}: {
  ref?: RefObject<HTMLElement | null>;
  /** Resolve `true` when the password was accepted. */
  onSubmit?: (values: SignInValues) => void | boolean | Promise<void | boolean>;
  onPasskey?: () => void;
  forgotHref?: string;
  busy?: boolean;
  error?: string | null;
  notice?: ReactNode;
}) {
  const id = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [via, setVia] = useState<"password" | "passkey">("password");
  const c = SIGN_IN_COPY.card;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setVia("password");
    const ok = await onSubmit?.({ username: username.trim(), password });
    if (ok === true) {
      setPassword("");
      setShow(false);
    }
  };

  return (
    <CardShell ref={ref} title={c.title} sub={c.sub} onSubmit={submit} busy={busy}>
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3 tiny:mt-3 tiny:gap-2.5">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-user`} className={labelClass}>
            {c.user}
          </label>
          <div className="si-field px-3.5" data-invalid={error ? "true" : undefined}>
            <UserRound aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
            <input
              id={`${id}-user`}
              name="username"
              autoComplete="username webauthn"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={c.userPlaceholder}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={`${id}-pass`} className={labelClass}>
              {c.password}
            </label>
            <a href={forgotHref} className={linkClass}>
              {c.forgot}
            </a>
          </div>
          <div className="si-field pl-3.5 pr-1" data-invalid={error ? "true" : undefined}>
            <Lock aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
            <input
              id={`${id}-pass`}
              name="password"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              required
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              aria-label={show ? "Hide password" : "Show password"}
              className="grid size-11 shrink-0 place-items-center rounded-[10px] text-[var(--si-fg-subtle)] transition-colors hover:text-[var(--si-fg)] focus-visible:outline-2 focus-visible:outline-[var(--si-blue)]"
            >
              {show ? <EyeOff className="size-[18px]" strokeWidth={1.75} /> : <Eye className="size-[18px]" strokeWidth={1.75} />}
            </button>
          </div>
        </div>

        {error ? (
          <p id={`${id}-error`} role="alert" className="text-[13px] text-[var(--si-danger)]">
            {error}
          </p>
        ) : null}
        {notice}

        <button type="submit" className="si-btn si-btn-primary mt-2 w-full short:mt-1" disabled={busy}>
          {c.submit}
          {busy && via === "password" ? <Spinner /> : <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />}
        </button>

        <div className="flex items-center gap-3 text-[12px] text-[var(--si-fg-subtle)] mini:hidden" aria-hidden="true">
          <span className="h-px flex-1 bg-[linear-gradient(90deg,transparent,var(--si-hairline-strong))]" />
          {c.or}
          <span className="h-px flex-1 bg-[linear-gradient(90deg,var(--si-hairline-strong),transparent)]" />
        </div>

        <button
          type="button"
          className="si-btn si-btn-outline w-full"
          onClick={() => {
            if (busy) return;
            setVia("passkey");
            onPasskey?.();
          }}
          disabled={busy}
        >
          {busy && via === "passkey" ? <Spinner /> : <Fingerprint aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />}
          {c.passkey}
        </button>
      </div>

      <CardFoot />
    </CardShell>
  );
}

/** First sign-in: the user must replace the password they were given (D32). */
export function ChangePasswordCard({
  ref,
  onSubmit,
  busy,
  error,
}: {
  ref?: RefObject<HTMLElement | null>;
  onSubmit?: (values: ChangePasswordValues) => void | Promise<void>;
  busy?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const t = SIGN_IN_COPY.changePassword;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== next;
  const ready = current.length > 0 && next.length >= 10 && next === confirm;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !ready) return;
    await onSubmit?.({ currentPassword: current, newPassword: next });
  };

  const field = (key: string, label: string, value: string, set: (v: string) => void, opts: { autoComplete: string; hint?: string; invalid?: boolean }) => (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-${key}`} className={labelClass}>
        {label}
      </label>
      <div className="si-field pl-3.5 pr-1" data-invalid={opts.invalid ? "true" : undefined}>
        <Lock aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
        <input
          id={`${id}-${key}`}
          type={show ? "text" : "password"}
          autoComplete={opts.autoComplete}
          value={value}
          onChange={(e) => set(e.target.value)}
          aria-invalid={opts.invalid || undefined}
          aria-describedby={opts.hint ? `${id}-${key}-hint` : undefined}
          required
        />
        {key === "current" ? (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide passwords" : "Show passwords"}
            className="grid size-11 shrink-0 place-items-center rounded-[10px] text-[var(--si-fg-subtle)] transition-colors hover:text-[var(--si-fg)] focus-visible:outline-2 focus-visible:outline-[var(--si-blue)]"
          >
            {show ? <EyeOff className="size-[18px]" strokeWidth={1.75} /> : <Eye className="size-[18px]" strokeWidth={1.75} />}
          </button>
        ) : null}
      </div>
      {opts.hint ? (
        <p id={`${id}-${key}-hint`} className={cn("text-[12px]", opts.invalid ? "text-[var(--si-danger)]" : "text-[var(--si-fg-subtle)]")}>
          {opts.hint}
        </p>
      ) : null}
    </div>
  );

  return (
    <CardShell ref={ref} title={t.title} sub={t.sub} onSubmit={submit} busy={busy}>
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3 tiny:mt-3 tiny:gap-2.5">
        {field("current", t.current, current, setCurrent, { autoComplete: "current-password" })}
        {field("next", t.next, next, setNext, { autoComplete: "new-password", hint: t.nextHint, invalid: next.length > 0 && next.length < 10 })}
        {field("confirm", t.confirm, confirm, setConfirm, { autoComplete: "new-password", hint: mismatch ? t.mismatch : undefined, invalid: mismatch })}
        {error ? (
          <p role="alert" className="text-[13px] text-[var(--si-danger)]">
            {error}
          </p>
        ) : null}
        <button type="submit" className="si-btn si-btn-primary mt-2 w-full short:mt-1" disabled={busy || !ready}>
          {t.submit}
          {busy ? <Spinner /> : <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />}
        </button>
      </div>
      <CardFoot />
    </CardShell>
  );
}

/**
 * The code step: six digit boxes for the authenticator code (submits itself on
 * the sixth digit), or one field for a recovery code. A wrong code keeps the
 * face, clears the boxes, shows the error under them and focuses the first box.
 */
export function CodeCard({
  ref,
  method,
  onVerify,
  onSwitch,
  onBack,
  busy,
  error,
  lockedMinutes,
}: {
  ref?: RefObject<HTMLElement | null>;
  method: TwoFactorValues["method"];
  /** Resolves `false` when the code was wrong (or locked): the face clears and refocuses. */
  onVerify: (values: TwoFactorValues) => Promise<boolean>;
  onSwitch: () => void;
  onBack: () => void;
  busy?: boolean;
  error?: string | null;
  /** Too many wrong codes: minutes left before trying again. */
  lockedMinutes?: number | null;
}) {
  const id = useId();
  const t = SIGN_IN_COPY.twoFactor;
  const totp = method === "totp";
  const [code, setCode] = useState("");
  const [retry, setRetry] = useState(0);
  const otp = useRef<OtpInputHandle>(null);
  const recovery = useRef<HTMLInputElement>(null);
  const locked = !!lockedMinutes;
  const ready = !locked && (totp ? /^\d{6}$/.test(code) : code.trim().length >= 8);
  const shownError = locked ? t.locked(lockedMinutes) : error;

  const verify = async (value: string) => {
    if (busy || locked) return;
    const ok = await onVerify({ code: totp ? value : value.trim(), method });
    if (!ok) {
      setCode("");
      setRetry((n) => n + 1);
    }
  };

  // after a wrong code, once the boxes are enabled again: back to the first one
  useEffect(() => {
    if (!retry || busy) return;
    if (totp) otp.current?.focus();
    else recovery.current?.focus();
  }, [retry, busy, totp]);

  return (
    <CardShell
      ref={ref}
      title={totp ? t.title : t.recoveryTitle}
      sub={totp ? t.sub : t.recoverySub}
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void verify(code);
      }}
      busy={busy}
    >
      <div className="mt-5 flex flex-col gap-4 short:mt-4 short:gap-3 tiny:mt-3 tiny:gap-2.5">
        <div className="flex flex-col gap-2">
          {totp ? (
            <>
              <p id={`${id}-label`} className={labelClass}>
                {t.code}
              </p>
              <OtpInput
                ref={otp}
                value={code}
                onChange={setCode}
                onComplete={(v) => void verify(v)}
                disabled={busy || locked}
                invalid={!!shownError}
                labelledBy={`${id}-label`}
                describedBy={shownError ? `${id}-error` : undefined}
              />
            </>
          ) : (
            <>
              <label htmlFor={`${id}-code`} className={labelClass}>
                {t.recovery}
              </label>
              <div className="si-field px-3.5" data-invalid={shownError ? "true" : undefined}>
                <ShieldCheck aria-hidden="true" className="mr-3 size-[18px] shrink-0 text-[var(--si-fg-subtle)]" strokeWidth={1.75} />
                <input
                  ref={recovery}
                  id={`${id}-code`}
                  name="recovery-code"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={32}
                  value={code}
                  disabled={busy || locked}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="xxxx-xxxx"
                  className="font-mono"
                  aria-invalid={shownError ? true : undefined}
                  aria-describedby={shownError ? `${id}-error` : undefined}
                  required
                />
              </div>
            </>
          )}
          {shownError ? (
            <p id={`${id}-error`} role="alert" className="text-[13px] text-[var(--si-danger)]">
              {shownError}
            </p>
          ) : null}
          <button type="button" onClick={onSwitch} className={cn(linkClass, "self-start")} disabled={busy}>
            {totp ? t.useRecovery : t.useApp}
          </button>
        </div>

        <button type="submit" className="si-btn si-btn-primary mt-1 w-full" disabled={busy || !ready}>
          {t.submit}
          {busy ? <Spinner /> : <ArrowRight aria-hidden="true" className="si-arrow size-[18px]" strokeWidth={2} />}
        </button>

        <button type="button" onClick={onBack} className="si-btn si-btn-ghost w-full" disabled={busy}>
          <ArrowLeft aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          {t.back}
        </button>
      </div>

      <CardFoot />
    </CardShell>
  );
}

export function CardFoot() {
  const c = SIGN_IN_COPY.card;
  return (
    <div className="mt-5 flex flex-col items-center gap-1.5 text-center text-[12px] text-[var(--si-fg-subtle)] short:mt-3 tiny:mt-2.5">
      <p className="flex items-center gap-1.5">
        <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2} />
        {c.footnote}
      </p>
      <p className="tiny:hidden">{c.helper}</p>
    </div>
  );
}
export function Spinner() {
  return (
    <svg className="size-[18px] animate-spin" viewBox="0 0 24 24" fill="none" role="img" aria-label="Signing in">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// ------------------------------------------------------------- top / bottom --

function TopBar() {
  return (
    <header className="si-enter relative z-10 flex h-[72px] shrink-0 items-center px-6 short:h-16 tiny:h-14 sm:px-10 lg:px-16" style={{ "--i": 0 } as CSSProperties}>
      {/* the logo mark only; the brand name and logo come from tenant settings later (white-label) */}
      <LogoMark />
    </header>
  );
}

function Footer({ systemStatus }: { systemStatus?: "operational" | null }) {
  const id = useId();
  return (
    <footer
      className="si-enter relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 px-6 pb-6 text-[13px] text-[var(--si-fg-subtle)] short:pb-3 tiny:pb-2 sm:px-10 lg:px-16"
      style={{ "--i": 7 } as CSSProperties}
    >
      <div className="flex items-center gap-4">
        <span suppressHydrationWarning>© {new Date().getFullYear()}</span>
        <label htmlFor={`${id}-lang`} className="sr-only">
          Language
        </label>
        <select
          id={`${id}-lang`}
          defaultValue="en-GB"
          className="h-11 cursor-pointer rounded-[10px] border border-[var(--si-hairline)] bg-transparent px-3 text-[13px] text-[var(--si-fg-muted)] outline-none transition-colors hover:border-[var(--si-hairline-strong)] focus-visible:border-[var(--si-blue)]"
        >
          <option value="en-GB">English</option>
        </select>
      </div>
      {systemStatus === "operational" ? (
        <p className="inline-flex h-11 items-center gap-2 font-mono text-[12px] text-[var(--si-fg-muted)]" role="status">
          <span className="si-live-dot" aria-hidden="true" />
          {SIGN_IN_COPY.status}
        </p>
      ) : null}
    </footer>
  );
}
