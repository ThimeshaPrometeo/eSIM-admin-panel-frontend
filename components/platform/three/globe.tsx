"use client";

/**
 * 3D globe (spec 7.5 item 1). Loaded only through ./lazy.tsx (dynamic import,
 * client only), so three, R3F, drei and gsap stay out of every page that does
 * not show it.
 *
 * - Land drawn as fine dots from the bundled land/country mask
 *   (lib/geo/globe-mask.json): dots are placed in latitude rows at run time,
 *   smaller toward the poles with a slight size jitter.
 * - Dark: soft Emerald dots with additive blending and a gentle glow, an ocean
 *   of dark glass with a thin fresnel edge, a wide Azure halo fading out.
 *   Light: a frosted-glass globe with darker Emerald dots and an Azure halo.
 * - Arcs between real countries hug the surface, Azure → Emerald, with light
 *   pulses travelling along them and soft ripples where they land.
 * - Modes: "hero" (sign-in: slow rotation, weighted tilt toward the mouse,
 *   faint distant particles), "interactive" (coverage: drag, zoom, hover,
 *   click, rotate to a country), "compact" (dashboard header).
 * - Performance (spec 7.7): DPR ≤ 1.5, the loop stops off screen / in a hidden
 *   tab and drops to on-demand rendering when idle. Reduced motion: one static
 *   frame (dragging still works, without inertia).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import gsap from "gsap";
import maskData from "@/lib/geo/globe-mask.json";
import { damp } from "@/lib/design/motion";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { useCanvasVisibility } from "./use-canvas-visibility";
import { themeTokens, useClosestTheme, type ThemeName } from "./use-closest-theme";

export type GlobeMode = "hero" | "interactive" | "compact";

const TOKENS = ["primary", "accent", "surface-1", "surface-2", "surface-3", "text-3", "bg"] as const;
type Palette = Record<(typeof TOKENS)[number], string>;

export type GlobeProps = {
  mode?: GlobeMode;
  /** ISO2 codes of covered countries. */
  lit?: string[];
  /**
   * Brightness per country (0–1), e.g. usage: overrides `lit` and `landTone`;
   * countries without a weight stay dim.
   */
  weights?: Record<string, number>;
  /**
   * Keep it alive (dashboard): drawing and spinning while on screen, never
   * dropping to on-demand rendering when the pointer is away; after a drag
   * the spin resumes on its own unless a country is focused.
   */
  live?: boolean;
  /** Zoom buttons: a new `id` applies the action (in, out, or reset the view). */
  zoomRequest?: { id: number; action: "in" | "out" | "reset" };
  /**
   * "coverage": covered countries lit, others dim (coverage page).
   * "all": all land lit (sign-in hero, dashboard).
   */
  landTone?: "coverage" | "all";
  /** Country pairs joined by arcs with travelling light. */
  arcs?: [string, string][];
  /** Rotates the globe to this country (interactive mode). */
  focusCountry?: string | null;
  selectedCountry?: string | null;
  onSelectCountry?: (iso2: string) => void;
  onHoverCountry?: (iso2: string | null) => void;
  /** Initial view centre [lat, lon]. */
  initialView?: [number, number];
  /** Routes between places by coordinates ([lat, lon]), e.g. city hubs. */
  routes?: { from: [number, number]; to: [number, number] }[];
  /** Pulsing pins at active places ([lat, lon]). */
  pins?: [number, number][];
  /** Spin speed in radians per second (default per mode). */
  spin?: number;
  /** Drag to rotate in hero mode (interactive mode always allows it). */
  draggable?: boolean;
  /** Faint dots over the ocean too, so land reads brighter than the sea. */
  oceanDots?: boolean;
  /** A thin tilted orbit ring with a glowing satellite moving along it. */
  orbit?: boolean;
  /**
   * Screen positions of these places, written every frame into
   * `projectionRef` (CSS px relative to the canvas, plus whether the place
   * faces the viewer). Lets the page draw things that start on the globe.
   */
  trackPoints?: [number, number][];
  projectionRef?: { current: { x: number; y: number; visible: boolean }[] };
  /**
   * Use other design tokens for the globe's roles, e.g. the sign-in palette:
   * { primary: "si-blue", accent: "si-teal", bg: "si-bg", "surface-2": "si-bg-raised" }.
   */
  tokens?: Partial<Record<(typeof TOKENS)[number], string>>;
  className?: string;
};

// ----------------------------------------------------------------- data --

type MaskData = { width: number; height: number; countries: string[]; centroids: Record<string, [number, number]>; rows: number[][] };
const MASK_DATA = maskData as unknown as MaskData;
const DEG = Math.PI / 180;

let decoded: Uint16Array | null = null;
function mask() {
  if (decoded) return decoded;
  const { width, height, rows } = MASK_DATA;
  const m = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    let x = 0;
    for (let i = 0; i < row.length; i += 2) {
      m.fill(row[i]!, y * width + x, y * width + x + row[i + 1]!);
      x += row[i + 1]!;
    }
  }
  return (decoded = m);
}

/** Country index (0-based) at a point, or -1 for ocean. */
function countryAt(lat: number, lon: number) {
  const { width: W, height: H } = MASK_DATA;
  const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
  const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
  return mask()[y * W + x]! - 1;
}

function toVec(lat: number, lon: number, r = 1) {
  const phi = lat * DEG;
  const theta = lon * DEG;
  return new THREE.Vector3(r * Math.cos(phi) * Math.sin(theta), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(theta));
}

/** Dot spacing in degrees per mode: denser on the large hero globe. */
const SPACING: Record<GlobeMode, number> = { hero: 0.62, interactive: 0.58, compact: 0.72 };

/**
 * Land dots in latitude rows: each row holds as many dots as fit its
 * circumference, alternate rows are offset by half a step (hexagonal
 * packing). Even spacing, no lattice artefacts. Dots shrink toward the poles
 * and carry a slight deterministic size jitter.
 */
const OCEAN = -5;

function buildDots(mode: GlobeMode, ocean = false) {
  const step = SPACING[mode];
  const pos: number[] = [];
  const country: number[] = [];
  const size: number[] = [];
  let row = 0;
  for (let lat = -89 + step / 2; lat < 89; lat += step, row++) {
    const cos = Math.cos(lat * DEG);
    const n = Math.max(1, Math.round((360 * cos) / step));
    const offset = (row % 2) * 0.5;
    for (let j = 0; j < n; j++) {
      const lon = ((j + offset) / n) * 360 - 180;
      const c = countryAt(lat, lon);
      if (c < 0 && (!ocean || (row + j) % 2 === 1)) continue; // ocean: every other dot
      const v = toVec(lat, lon, 1.002);
      pos.push(v.x, v.y, v.z);
      country.push(c < 0 ? OCEAN : c);
      const h = ((Math.imul(row * 7919 + j, 2654435761) >>> 0) % 1000) / 1000;
      size.push(Math.max(0.55, Math.pow(cos, 0.6)) * (0.85 + 0.3 * h) * (c < 0 ? 0.7 : 1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aCountry", new THREE.Float32BufferAttribute(country, 1));
  g.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
  g.setAttribute("aLit", new THREE.Float32BufferAttribute(new Float32Array(country.length), 1));
  return g;
}

// ---------------------------------------------------------------- shaders --

const dotVertex = /* glsl */ `
  attribute float aCountry;
  attribute float aLit;
  attribute float aSize;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uScale;     // canvas height / 900: dots stay proportional to the globe
  uniform float uHover;
  uniform float uSelected;
  varying float vLit;
  varying float vFacing;
  varying float vMark;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // facing toward the camera from this dot (perspective-correct)
    vFacing = dot(normalize(normalMatrix * position), normalize(-mv.xyz));
    vLit = aLit;
    float hovered = 1.0 - step(0.5, abs(aCountry - uHover));
    float selected = 1.0 - step(0.5, abs(aCountry - uSelected));
    vMark = max(hovered * 0.8, selected);
    gl_PointSize = uSize * aSize * (1.0 + vMark * 0.5) * uPixelRatio * uScale * (4.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uDim;
  uniform vec3 uLitColor;
  uniform vec3 uMarkColor;
  uniform float uGlow;      // dark: soft halo around each dot (bloom-like with additive blending)
  uniform float uOpacity;
  uniform float uDimAlpha;  // how visible unlit dots are (ocean, uncovered countries)
  uniform float uSharp;     // 0 = soft dot edge (dark), 1 = crisp edge (light)
  varying float vLit;
  varying float vFacing;
  varying float vMark;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.5, mix(0.18, 0.4, uSharp), d);
    float halo = exp(-d * d * 18.0) * uGlow;
    vec3 col = mix(uDim, uLitColor, vLit);
    col = mix(col, uMarkColor, vMark);
    float a = max(core, halo * max(vLit, vMark)) * mix(uDimAlpha, 1.0, max(vLit, vMark));
    // fade toward the limb so the edge stays soft
    a *= smoothstep(0.04, 0.42, vFacing) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(col, a);
  }
`;

const oceanVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const oceanFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  uniform vec3 uEdge;
  uniform float uEdgeStrength;
  uniform float uEdgePower;  // higher = thinner edge light
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    // inner gradient: light from the upper left, like glass
    float light = clamp(dot(vNormal, normalize(vec3(-0.45, 0.65, 0.6))) * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uBottom, uTop, smoothstep(0.1, 1.0, light));
    // thin fresnel edge light
    float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), uEdgePower);
    col += uEdge * fres * uEdgeStrength;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const haloVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const haloFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform float uExtent;   // halo radius in globe radii
  varying vec2 vUv;
  void main() {
    float r = length(vUv) * uExtent;          // 1.0 = the globe's edge
    float t = clamp((r - 1.0) / (uExtent - 1.0), 0.0, 1.0);
    float a = pow(1.0 - t, 3.0) * uStrength;   // wide and soft, no ring
    gl_FragColor = vec4(uColor, a);
  }
`;

const pulseVertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aAlpha;
  attribute float aSize;
  uniform float uPixelRatio;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vColor = aColor;
    vAlpha = aAlpha * smoothstep(0.32, 0.55, dot(normalize(normalMatrix * position), normalize(-mv.xyz)));
    gl_PointSize = aSize * uPixelRatio * uScale * (4.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const pulseFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = exp(-d * d * 22.0) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor + vec3(0.25) * smoothstep(0.2, 0.0, d), a);
  }
`;

const arcVertex = /* glsl */ `
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vFacing;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // facing toward the camera from this point (perspective-correct)
    vFacing = dot(normalize(normalMatrix * position), normalize(-mv.xyz));
    gl_Position = projectionMatrix * mv;
  }
`;

const arcFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFacing;
  void main() {
    // A point lifted up to 5% above the surface lies outside the silhouette
    // once its facing drops below ~0.3: fade before that, so arcs never float
    // past the globe's edge.
    float a = smoothstep(0.32, 0.55, vFacing) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

// ------------------------------------------------------------------ scene --

type SceneProps = Required<Pick<GlobeProps, "mode">> &
  Omit<GlobeProps, "className" | "mode" | "tokens"> & {
    palette: Palette;
    theme: ThemeName;
    reduced: boolean;
    onActivity: () => void;
  };

const TRAIL = 18;
const CYCLE = 4.2; // seconds per arc pulse + ripple

function GlobeScene({
  mode,
  lit = [],
  weights,
  landTone = mode === "interactive" ? "coverage" : "all",
  oceanDots = false,
  orbit = false,
  trackPoints = [],
  projectionRef,
  arcs = [],
  focusCountry,
  selectedCountry,
  onSelectCountry,
  onHoverCountry,
  initialView = [22, 58],
  routes = [],
  pins = [],
  spin,
  draggable = false,
  live = false,
  zoomRequest,
  palette,
  theme,
  reduced,
  onActivity,
}: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const { camera, gl, size, invalidate } = useThree();
  const light = theme === "light";
  const countryIndex = useMemo(() => new Map(MASK_DATA.countries.map((c, i) => [c, i])), []);

  const rot = useRef({ x: initialView[0] * DEG, y: -initialView[1] * DEG, vx: 0, vy: 0, px: 0, py: 0, tpx: 0, tpy: 0 });
  const baseZ = mode === "compact" ? 3.9 : mode === "hero" ? 4.9 : 4.1;
  const zoom = useRef({ z: baseZ, tz: baseZ });
  const drag = useRef<{ x: number; y: number; t: number } | null>(null);
  const focusTween = useRef<gsap.core.Tween | null>(null);
  const autoSpin = useRef(mode !== "interactive" || !focusCountry);
  const focusNow = useRef(focusCountry);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    focusNow.current = focusCountry;
  });
  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);
  const clock = useRef(0);

  // ---- land dots
  const geometry = useMemo(() => buildDots(mode, oceanDots), [mode, oceanDots]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    const litSet = new Set(lit.map((c) => countryIndex.get(c.toUpperCase())).filter((x): x is number => x !== undefined));
    const byIndex = weights
      ? new Map(Object.entries(weights).flatMap(([iso, w]) => {
          const i = countryIndex.get(iso.toUpperCase());
          return i === undefined ? [] : [[i, Math.max(0, Math.min(1, w))] as const];
        }))
      : null;
    const attr = geometry.getAttribute("aLit") as THREE.BufferAttribute;
    const country = geometry.getAttribute("aCountry") as THREE.BufferAttribute;
    for (let i = 0; i < attr.count; i++) {
      const c = country.getX(i);
      attr.setX(i, c < 0 ? 0 : byIndex ? (byIndex.get(c) ?? 0) : landTone === "all" || litSet.has(c) ? 1 : 0);
    }
    attr.needsUpdate = true;
    invalidate();
  }, [lit, weights, landTone, geometry, countryIndex, invalidate]);

  const materials = useMemo(() => {
    const dots = new THREE.ShaderMaterial({
      vertexShader: dotVertex,
      fragmentShader: dotFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uSize: { value: 1.3 },
        uPixelRatio: { value: 1 },
        uScale: { value: 1 },
        uHover: { value: -1 },
        uSelected: { value: -1 },
        uDim: { value: new THREE.Color() },
        uLitColor: { value: new THREE.Color() },
        uMarkColor: { value: new THREE.Color() },
        uGlow: { value: 0.35 },
        uOpacity: { value: 1 },
        uDimAlpha: { value: 0.35 },
        uSharp: { value: 0 },
      },
    });
    const ocean = new THREE.ShaderMaterial({
      vertexShader: oceanVertex,
      fragmentShader: oceanFragment,
      uniforms: { uTop: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() }, uEdgeStrength: { value: 0.6 }, uEdgePower: { value: 5 } },
    });
    const halo = new THREE.ShaderMaterial({
      vertexShader: haloVertex,
      fragmentShader: haloFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color() }, uStrength: { value: 0.5 }, uExtent: { value: 1.45 } },
    });
    const pulses = new THREE.ShaderMaterial({
      vertexShader: pulseVertex,
      fragmentShader: pulseFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uPixelRatio: { value: 1 }, uScale: { value: 1 } },
    });
    const arcLine = new THREE.ShaderMaterial({
      vertexShader: arcVertex,
      fragmentShader: arcFragment,
      transparent: true,
      depthWrite: false,
      uniforms: { uOpacity: { value: 0.6 } },
    });
    return { dots, ocean, halo, pulses, arcLine };
  }, []);
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials]);

  // ---- palette → uniforms
  useEffect(() => {
    const c = (s: string) => new THREE.Color(s);
    const { dots, ocean, halo, pulses, arcLine } = materials;
    arcLine.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
    arcLine.uniforms.uOpacity!.value = light ? 0.75 : mode === "compact" ? 0.55 : mode === "hero" ? 0.95 : 0.7;
    if (light) {
      // Light: crisp, darker Emerald dots on a clearly defined frosted-glass
      // sphere with a thin Azure edge light and a soft Azure halo; no haze.
      dots.blending = THREE.NormalBlending;
      dots.uniforms.uLitColor!.value = c(palette.accent); // #00A877
      dots.uniforms.uDim!.value = oceanDots ? c(palette.primary).lerp(c(palette["text-3"]), 0.5) : c(palette["text-3"]);
      dots.uniforms.uDimAlpha!.value = oceanDots ? 0.1 : 0.3;
      dots.uniforms.uGlow!.value = 0.0;
      dots.uniforms.uSharp!.value = 1;
      dots.uniforms.uOpacity!.value = 1;
      ocean.uniforms.uTop!.value = c(palette["surface-1"]).lerp(c(palette.primary), 0.025);
      ocean.uniforms.uBottom!.value = c(palette["surface-3"]).lerp(c(palette.primary), 0.12);
      ocean.uniforms.uEdge!.value = c(palette.primary);
      ocean.uniforms.uEdgeStrength!.value = 0.85;
      ocean.uniforms.uEdgePower!.value = 9;
      halo.blending = THREE.NormalBlending;
      halo.uniforms.uStrength!.value = 0.1;
      pulses.blending = THREE.NormalBlending;
    } else {
      dots.uniforms.uSharp!.value = 0;
      ocean.uniforms.uEdgePower!.value = 5;
      dots.blending = THREE.AdditiveBlending;
      // soft Emerald: a touch of the surface so it glows rather than shouts
      dots.uniforms.uLitColor!.value = c(palette.accent).lerp(c(palette["surface-3"]), 0.12);
      // unlit dots: ocean dots are a faint blue so land reads brighter than the sea
      dots.uniforms.uDim!.value = oceanDots ? c(palette.primary).lerp(c(palette.bg), 0.45) : c(palette["text-3"]);
      dots.uniforms.uDimAlpha!.value = oceanDots ? 0.2 : 0.35;
      dots.uniforms.uGlow!.value = mode === "compact" ? 0.28 : mode === "hero" ? 0.5 : 0.38;
      dots.uniforms.uOpacity!.value = mode === "compact" ? 0.78 : mode === "hero" ? 1 : 0.85;
      ocean.uniforms.uTop!.value = c(palette["surface-2"]).lerp(c(palette.primary), 0.05);
      ocean.uniforms.uBottom!.value = c(palette.bg);
      ocean.uniforms.uEdge!.value = c(palette.primary);
      ocean.uniforms.uEdgeStrength!.value = 0.75;
      halo.blending = THREE.AdditiveBlending;
      halo.uniforms.uStrength!.value = mode === "compact" ? 0.32 : 0.42;
      pulses.blending = THREE.AdditiveBlending;
    }
    dots.uniforms.uMarkColor!.value = c(palette.primary);
    dots.uniforms.uSize!.value = mode === "compact" ? 2.2 : mode === "hero" ? 2.7 : 2.4;
    // light: lean slightly toward cyan so the halo reads Azure, never lavender
    halo.uniforms.uColor!.value = light ? c(palette.primary).lerp(c(palette.accent), 0.12) : c(palette.primary);
    halo.uniforms.uExtent!.value = light ? 1.22 : mode === "hero" ? 1.5 : 1.3;
    Object.values(materials).forEach((m) => (m.needsUpdate = true));
    invalidate();
  }, [palette, light, mode, oceanDots, materials, invalidate]);

  useEffect(() => {
    const scale = Math.min(2.2, Math.max(0.6, Math.min(size.width, size.height) / 900));
    materials.dots.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    materials.dots.uniforms.uScale!.value = scale;
    materials.pulses.uniforms.uPixelRatio!.value = gl.getPixelRatio();
    materials.pulses.uniforms.uScale!.value = scale;
  }, [gl, size, materials]);

  useEffect(() => {
    materials.dots.uniforms.uSelected!.value = selectedCountry ? (countryIndex.get(selectedCountry.toUpperCase()) ?? -1) : -1;
    invalidate();
  }, [selectedCountry, countryIndex, materials, invalidate]);

  // ---- rotate to a country (gsap, movement easing)
  useEffect(() => {
    if (!focusCountry) {
      // focus cleared: a live globe starts turning again
      if (live) {
        autoSpin.current = true;
        invalidate();
      }
      return;
    }
    const target = MASK_DATA.centroids[focusCountry.toUpperCase()];
    if (!target) return;
    autoSpin.current = false;
    const r = rot.current;
    const tx = Math.max(-60, Math.min(60, target[0])) * DEG;
    let ty = -target[1] * DEG;
    ty = r.y + ((((ty - r.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI; // short way round
    focusTween.current?.kill();
    r.vx = 0;
    r.vy = 0;
    focusTween.current = gsap.to(r, {
      x: tx,
      y: ty,
      duration: reduced ? 0 : 1.3,
      ease: "power3.inOut",
      onUpdate: () => {
        onActivity();
        invalidate();
      },
    });
    onActivity();
    return () => {
      focusTween.current?.kill();
    };
  }, [focusCountry, reduced, invalidate, onActivity, live]);

  // ---- zoom buttons (wheel and pinch are handled with the pointer)
  const zoomId = zoomRequest?.id;
  useEffect(() => {
    if (!zoomRequest) return;
    const z = zoom.current;
    if (zoomRequest.action === "in") z.tz = Math.max(2.4, z.tz / 1.25);
    else if (zoomRequest.action === "out") z.tz = Math.min(5.2, z.tz * 1.25);
    else {
      z.tz = baseZ;
      focusTween.current?.kill();
      if (!focusNow.current) {
        // back to the starting view, turning again
        gsap.to(rot.current, { x: initialView[0] * DEG, duration: reduced ? 0 : 0.9, ease: "power3.inOut", onUpdate: () => invalidate() });
        autoSpin.current = true;
      }
    }
    if (reduced) z.z = z.tz;
    onActivity();
    invalidate();
    // runs once per request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomId]);

  // ---- arcs: surface-hugging great circles, gradient, pulse + ripple
  const arcPaths = useMemo(() => {
    const azure = new THREE.Color(palette.primary);
    const emerald = new THREE.Color(palette.accent);
    const pairs: { key: string; a: [number, number]; b: [number, number] }[] = [
      ...arcs.flatMap(([x, y]) => {
        const ca = MASK_DATA.centroids[x.toUpperCase()];
        const cb = MASK_DATA.centroids[y.toUpperCase()];
        return ca && cb ? [{ key: `${x}-${y}`, a: ca, b: cb }] : [];
      }),
      ...routes.map((rt) => ({ key: `${rt.from.join(",")}-${rt.to.join(",")}`, a: rt.from, b: rt.to })),
    ];
    return pairs
      .map(({ key, a: ca, b: cb }, i) => {
        const va = toVec(ca[0], ca[1]);
        const vb = toVec(cb[0], cb[1]);
        // low lift: arcs hug the surface and never float past the silhouette
        const lift = 0.006 + va.angleTo(vb) * 0.03;
        const q = new THREE.Quaternion().setFromUnitVectors(va, vb);
        const pts: THREE.Vector3[] = [];
        const colors: THREE.Color[] = [];
        for (let s = 0; s <= 96; s++) {
          const t = s / 96;
          pts.push(va.clone().applyQuaternion(new THREE.Quaternion().slerp(q, t)).multiplyScalar(1.003 + Math.sin(Math.PI * t) * lift));
          colors.push(azure.clone().lerp(emerald, t));
        }
        const ripple = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        geo.setAttribute("aColor", new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3));
        return { key, pts, geo, end: vb.clone().multiplyScalar(1.004), ripple, phase: i / Math.max(1, pairs.length) };
      })
  }, [arcs, routes, palette]);
  useEffect(() => () => arcPaths.forEach((a) => a.geo.dispose()), [arcPaths]);
  const arcLines = useMemo(() => arcPaths.map((a) => new THREE.Line(a.geo, materials.arcLine)), [arcPaths, materials]);

  const pulseGeometry = useMemo(() => {
    const n = arcPaths.length * TRAIL;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [arcPaths]);
  useEffect(() => () => pulseGeometry.dispose(), [pulseGeometry]);

  const rippleMaterials = useMemo(
    () =>
      arcPaths.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.accent),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
      ),
    [arcPaths, palette, light],
  );
  useEffect(() => () => rippleMaterials.forEach((m) => m.dispose()), [rippleMaterials]);
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([]);

  const pinData = useMemo(
    () =>
      pins.map(([lat, lon], i) => {
        const v = toVec(lat, lon, 1.004);
        return { key: `${lat},${lon}`, pos: v, q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize()), phase: (i * 0.37) % 1 };
      }),
    [pins],
  );
  const pinGeometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = pinData.length;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pinData.flatMap((p) => [p.pos.x, p.pos.y, p.pos.z]), 3));
    const col = new THREE.Color(palette.accent).lerp(new THREE.Color("white"), 0.35);
    g.setAttribute("aColor", new THREE.Float32BufferAttribute(Array.from({ length: n }, () => [col.r, col.g, col.b]).flat(), 3));
    g.setAttribute("aAlpha", new THREE.Float32BufferAttribute(new Array(n).fill(1), 1));
    g.setAttribute("aSize", new THREE.Float32BufferAttribute(new Array(n).fill(9), 1));
    return g;
  }, [pinData, palette]);
  useEffect(() => () => pinGeometry.dispose(), [pinGeometry]);
  const pinRingMaterials = useMemo(
    () =>
      pinData.map(
        () =>
          new THREE.MeshBasicMaterial({
            color: new THREE.Color(palette.accent),
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
            side: THREE.DoubleSide,
          }),
      ),
    [pinData, palette, light],
  );
  useEffect(() => () => pinRingMaterials.forEach((m) => m.dispose()), [pinRingMaterials]);
  const pinRefs = useRef<(THREE.Mesh | null)[]>([]);

  // ---- orbit ring with a satellite
  const ORBIT_R = 1.36;
  const orbitLine = useMemo(() => {
    if (!orbit) return null;
    const pts: number[] = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      pts.push(Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
    return new THREE.Line(g, m);
  }, [orbit]);
  useEffect(() => {
    if (!orbitLine) return;
    (orbitLine.material as THREE.LineBasicMaterial).color = new THREE.Color(palette.primary).lerp(new THREE.Color(palette.accent), 0.35);
    return undefined;
  }, [orbitLine, palette]);
  useEffect(
    () => () => {
      orbitLine?.geometry.dispose();
      (orbitLine?.material as THREE.Material | undefined)?.dispose();
    },
    [orbitLine],
  );
  const SAT_TRAIL = 10;
  const satGeometry = useMemo(() => {
    if (!orbit) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SAT_TRAIL * 3), 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(SAT_TRAIL * 3), 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(SAT_TRAIL), 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(SAT_TRAIL), 1));
    return g;
  }, [orbit]);
  useEffect(() => () => satGeometry?.dispose(), [satGeometry]);

  // ---- distant particles (hero only, dark)
  const particles = useMemo(() => {
    if (mode !== "hero") return null;
    const n = 520;
    const p = new Float32Array(n * 3);
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(4 + rnd() * 5);
      if (v.z > 2.5) v.z = -v.z; // keep them behind the globe, not in the camera's face
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    return g;
  }, [mode]);
  useEffect(() => () => particles?.dispose(), [particles]);
  const particleMaterial = useMemo(
    () => new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  useEffect(() => {
    particleMaterial.color = new THREE.Color(palette.primary).lerp(new THREE.Color("white"), 0.5);
    particleMaterial.opacity = light ? 0 : 0.22;
  }, [palette, light, particleMaterial]);
  useEffect(() => () => particleMaterial.dispose(), [particleMaterial]);

  // ---- interaction
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const sphere = useMemo(() => new THREE.Sphere(new THREE.Vector3(), 1), []);
  const hovered = useRef<string | null>(null);
  const downAt = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = gl.domElement;
    const pick = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = raycaster.ray.intersectSphere(sphere, new THREE.Vector3());
      if (!hit || !group.current) return null;
      const local = group.current.worldToLocal(hit.clone()).normalize();
      const c = countryAt(Math.asin(local.y) / DEG, Math.atan2(local.x, local.z) / DEG);
      return c < 0 ? null : MASK_DATA.countries[c]!;
    };

    const onWindowMove = (e: PointerEvent) => {
      rot.current.tpx = (e.clientX / window.innerWidth) * 2 - 1;
      rot.current.tpy = (e.clientY / window.innerHeight) * 2 - 1;
      onActivity();
    };
    const interactive = mode === "interactive";
    if (!interactive) window.addEventListener("pointermove", onWindowMove);
    if (!interactive && !draggable) return () => window.removeEventListener("pointermove", onWindowMove);

    el.style.touchAction = interactive ? "none" : "pan-y";
    el.style.cursor = "grab";
    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      downAt.current = { x: e.clientX, y: e.clientY };
      autoSpin.current = false;
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
      focusTween.current?.kill();
      el.style.cursor = "grabbing";
      onActivity();
    };
    const onMove = (e: PointerEvent) => {
      onActivity();
      if (drag.current) {
        if (!interactive) onWindowMove(e);
        const now = performance.now();
        const dx = e.clientX - drag.current.x;
        const dy = e.clientY - drag.current.y;
        const k = (1.6 / el.clientHeight) * (zoom.current.z / 4);
        rot.current.y += dx * k;
        rot.current.x = Math.max(-1.2, Math.min(1.2, rot.current.x + dy * k));
        const dt = Math.max(1, now - drag.current.t);
        rot.current.vy = reduced ? 0 : ((dx * k) / dt) * 1000;
        rot.current.vx = reduced ? 0 : ((dy * k) / dt) * 1000;
        drag.current = { x: e.clientX, y: e.clientY, t: now };
        invalidate();
        return;
      }
      if (!interactive) return;
      const iso = pick(e.clientX, e.clientY);
      if (iso !== hovered.current) {
        hovered.current = iso;
        materials.dots.uniforms.uHover!.value = iso ? (countryIndex.get(iso) ?? -1) : -1;
        el.style.cursor = iso ? "pointer" : "grab";
        onHoverCountry?.(iso);
        invalidate();
      }
    };
    const onUp = (e: PointerEvent) => {
      const start = downAt.current;
      drag.current = null;
      el.style.cursor = hovered.current ? "pointer" : "grab";
      if (interactive && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 5) {
        const iso = pick(e.clientX, e.clientY);
        if (iso) onSelectCountry?.(iso);
      }
      downAt.current = null;
    };
    const onLeave = () => {
      if (hovered.current) {
        hovered.current = null;
        materials.dots.uniforms.uHover!.value = -1;
        onHoverCountry?.(null);
        invalidate();
      }
    };
    const onWheel = (e: WheelEvent) => {
      if (!interactive) return;
      e.preventDefault();
      zoom.current.tz = Math.max(2.4, Math.min(5.2, zoom.current.tz * Math.exp(e.deltaY * 0.0012)));
      onActivity();
      invalidate();
    };
    const touches = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const onTouchDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onTouchMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (pinch) zoom.current.tz = Math.max(2.4, Math.min(5.2, zoom.current.tz * (pinch / d)));
        pinch = d;
        drag.current = null;
        invalidate();
      }
    };
    const onTouchUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinch = 0;
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerdown", onTouchDown);
    // drag-to-rotate ends spinning only in interactive mode; the hero resumes its spin
    const resume = () => {
      if (!interactive) autoSpin.current = true;
      // a live interactive globe picks its spin up again a moment after the drag, unless a country is in focus
      else if (live) {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => {
          if (!focusNow.current) autoSpin.current = true;
        }, 3500);
      }
    };
    el.addEventListener("pointerup", resume);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointermove", onTouchMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointerup", onTouchUp);
    el.addEventListener("pointercancel", onTouchUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("pointermove", onWindowMove);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerdown", onTouchDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointermove", onTouchMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointerup", onTouchUp);
      el.removeEventListener("pointercancel", onTouchUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl, camera, mode, draggable, raycaster, sphere, countryIndex, materials, onSelectCountry, onHoverCountry, invalidate, reduced, onActivity, live]);

  // ---- frame loop
  const azure = useMemo(() => new THREE.Color(palette.primary), [palette]);
  const emerald = useMemo(() => new THREE.Color(palette.accent), [palette]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const r = rot.current;
    const g = group.current;
    if (!g) return;

    if (!reduced) {
      clock.current += dt;
      if (!drag.current) {
        r.y += r.vy * dt;
        r.x = Math.max(-1.2, Math.min(1.2, r.x + r.vx * dt));
        r.vy = damp(r.vy, 0, 0.02, dt);
        r.vx = damp(r.vx, 0, 0.02, dt);
        if (autoSpin.current) r.y += dt * (spin ?? (mode === "hero" ? 0.028 : mode === "compact" ? 0.035 : 0.03));
      }
      r.px = damp(r.px, r.tpx, 0.08, dt);
      r.py = damp(r.py, r.tpy, 0.08, dt);
      zoom.current.z = damp(zoom.current.z, zoom.current.tz, 0.002, dt);
    } else {
      zoom.current.z = zoom.current.tz;
      clock.current = CYCLE * 0.45; // a still frame with the pulses part-way along
    }
    const tiltK = mode === "hero" ? 0.14 : mode === "compact" ? 0.07 : 0;
    g.rotation.set(r.x + r.py * tiltK, r.y + r.px * tiltK * 1.4, 0);
    // keep the whole globe and its halo inside narrow, tall canvases
    camera.position.z = zoom.current.z * Math.max(1, size.height / Math.max(1, size.width));

    // pulses travel along each arc, then a ripple opens where they land
    const pos = pulseGeometry.getAttribute("position") as THREE.BufferAttribute;
    const col = pulseGeometry.getAttribute("aColor") as THREE.BufferAttribute;
    const alpha = pulseGeometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const psize = pulseGeometry.getAttribute("aSize") as THREE.BufferAttribute;
    arcPaths.forEach((arc, i) => {
      const u = (clock.current / CYCLE + arc.phase) % 1;
      const travel = 0.55;
      const head = u < travel ? 1 - Math.pow(1 - u / travel, 2.2) : 1.0;
      for (let k = 0; k < TRAIL; k++) {
        const t = Math.max(0, head - k * 0.011);
        const f = t * (arc.pts.length - 1);
        const a = arc.pts[Math.floor(f)]!;
        const b = arc.pts[Math.min(arc.pts.length - 1, Math.ceil(f))]!;
        const idx = i * TRAIL + k;
        pos.setXYZ(idx, a.x + (b.x - a.x) * (f % 1), a.y + (b.y - a.y) * (f % 1), a.z + (b.z - a.z) * (f % 1));
        tmp.copy(azure).lerp(emerald, t);
        col.setXYZ(idx, tmp.r, tmp.g, tmp.b);
        const visible = u < travel ? 1 : Math.max(0, 1 - (u - travel) * 8);
        const fade = Math.pow(1 - k / TRAIL, 1.6);
        alpha.setX(idx, fade * visible * (light ? 0.9 : 1));
        psize.setX(idx, (k === 0 ? 12 : 9 * fade + 1.5) * (mode === "compact" ? 0.8 : 1));
      }
      const ring = rippleRefs.current[i];
      if (ring) {
        const v = u < travel ? -1 : (u - travel) / (1 - travel);
        ring.scale.setScalar(v < 0 ? 0.0001 : 0.012 + v * 0.07);
        (ring.material as THREE.MeshBasicMaterial).opacity = v < 0 ? 0 : Math.pow(1 - v, 2) * (light ? 0.75 : 0.9);
      }
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
    alpha.needsUpdate = true;
    psize.needsUpdate = true;

    // satellite along the orbit, with a short fading trail
    if (satGeometry) {
      const sp = satGeometry.getAttribute("position") as THREE.BufferAttribute;
      const sc = satGeometry.getAttribute("aColor") as THREE.BufferAttribute;
      const sa = satGeometry.getAttribute("aAlpha") as THREE.BufferAttribute;
      const ss = satGeometry.getAttribute("aSize") as THREE.BufferAttribute;
      const base = clock.current * 0.32;
      for (let k = 0; k < SAT_TRAIL; k++) {
        const a = base - k * 0.035;
        sp.setXYZ(k, Math.cos(a) * ORBIT_R, 0, Math.sin(a) * ORBIT_R);
        tmp.copy(emerald).lerp(azure, k / SAT_TRAIL);
        sc.setXYZ(k, tmp.r, tmp.g, tmp.b);
        sa.setX(k, Math.pow(1 - k / SAT_TRAIL, 1.8));
        ss.setX(k, k === 0 ? 10 : 6 * (1 - k / SAT_TRAIL) + 1);
      }
      sp.needsUpdate = sc.needsUpdate = sa.needsUpdate = ss.needsUpdate = true;
    }

    // screen positions of tracked places, for page effects
    if (projectionRef && trackPoints.length) {
      const out = projectionRef.current;
      out.length = trackPoints.length;
      for (let i = 0; i < trackPoints.length; i++) {
        const [lat, lon] = trackPoints[i]!;
        const local = toVec(lat, lon, 1.004);
        const world = g.localToWorld(local.clone());
        const toCam = camera.position.clone().sub(world).normalize();
        const facing = world.clone().normalize().dot(toCam);
        const ndc = world.clone().project(camera);
        out[i] = { x: ((ndc.x + 1) / 2) * size.width, y: ((1 - ndc.y) / 2) * size.height, visible: facing > 0.3 };
      }
    }

    // pins: a soft ring opens and fades, looping
    pinData.forEach((pin, i) => {
      const ring = pinRefs.current[i];
      if (!ring) return;
      const v = (clock.current / 2.6 + pin.phase) % 1;
      ring.scale.setScalar(0.012 + v * 0.05);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.pow(1 - v, 1.6) * (light ? 0.6 : 0.85);
    });
  });

  return (
    <>
      {particles ? <points geometry={particles} material={particleMaterial} renderOrder={-1} /> : null}
      {/* halo: camera-facing, outside the rotating group */}
      <mesh material={materials.halo} renderOrder={0}>
        <planeGeometry args={[3.2, 3.2]} />
      </mesh>
      {orbitLine && satGeometry ? (
        <group rotation={[0.3, 0, 0.42]}>
          <primitive object={orbitLine} renderOrder={3} />
          <points geometry={satGeometry} material={materials.pulses} renderOrder={4} />
        </group>
      ) : null}
      <group ref={group}>
        <mesh material={materials.ocean} renderOrder={1}>
          <sphereGeometry args={[1, 96, 96]} />
        </mesh>
        <points geometry={geometry} material={materials.dots} renderOrder={2} />
        {arcPaths.map((arc, i) => (
          <group key={arc.key} renderOrder={3}>
            <primitive object={arcLines[i]!} />
            <mesh
              ref={(el) => {
                rippleRefs.current[i] = el;
              }}
              position={arc.end}
              quaternion={arc.ripple}
              material={rippleMaterials[i]}
              scale={0.0001}
            >
              <ringGeometry args={[0.82, 1, 48]} />
            </mesh>
          </group>
        ))}
        {arcPaths.length ? <points geometry={pulseGeometry} material={materials.pulses} renderOrder={4} /> : null}
        {pinData.map((pin, i) => (
          <mesh
            key={pin.key}
            ref={(el) => {
              pinRefs.current[i] = el;
            }}
            position={pin.pos}
            quaternion={pin.q}
            material={pinRingMaterials[i]}
            scale={0.0001}
            renderOrder={3}
          >
            <ringGeometry args={[0.78, 1, 48]} />
          </mesh>
        ))}
        {pinData.length ? <points geometry={pinGeometry} material={materials.pulses} renderOrder={5} /> : null}
      </group>
    </>
  );
}

// ------------------------------------------------------------------ canvas --

export default function Globe({ className, mode = "hero", tokens, ...props }: GlobeProps) {
  const live = !!props.live;
  const host = useRef<HTMLDivElement>(null);
  const theme = useClosestTheme(host);
  const reduced = useReducedMotion();
  const visible = useCanvasVisibility(host);
  const tokenKey = JSON.stringify(tokens ?? {});
  const palette = useMemo<Palette>(() => {
    const map = JSON.parse(tokenKey) as Partial<Record<(typeof TOKENS)[number], string>>;
    const names = TOKENS.map((t) => map[t] ?? t);
    const read = themeTokens(theme, names);
    return Object.fromEntries(TOKENS.map((t, i) => [t, read[names[i]!]!])) as Palette;
  }, [theme, tokenKey]);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Idle = no pointer activity for a while. The hero keeps turning; the
  // interactive and compact globes drop to on-demand rendering.
  const armIdle = useMemo(
    () => () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (mode !== "hero" && !live) idleTimer.current = setTimeout(() => setIdle(true), 12000);
    },
    [mode, live],
  );
  const onActivity = useMemo(
    () => () => {
      setIdle((v) => (v ? false : v));
      armIdle();
    },
    [armIdle],
  );
  useEffect(() => {
    armIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [armIdle]);

  const frameloop = !visible ? "never" : reduced || idle ? "demand" : "always";

  return (
    <div ref={host} className={className} style={{ position: "relative", width: "100%", height: "100%" }} data-frameloop={frameloop}>
      <Canvas
        dpr={[1, 1.5]}
        frameloop={frameloop}
        camera={{ fov: 35, near: 0.1, far: 30, position: [0, 0, mode === "compact" ? 3.9 : mode === "hero" ? 4.9 : 4.1] }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ position: "absolute", inset: 0 }}
        aria-label="Globe of covered countries"
        role="img"
      >
        <GlobeScene mode={mode} palette={palette} theme={theme} reduced={reduced} onActivity={onActivity} {...props} />
      </Canvas>
    </div>
  );
}
