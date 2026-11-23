"use client";

/**
 * Fluid shader background (spec 7.5 item 2): slow, dark, domain-warped noise
 * in Azure and Emerald tones that drifts gently toward the mouse. Loaded only
 * through ./lazy.tsx. Only behind the sign-in page and the dashboard header,
 * never behind tables or forms.
 *
 * Cheap by design (spec 7.7): rendered at 0.4× resolution (the browser scales
 * it up; the noise is soft so it doesn't show), three noise octaves, one
 * full-screen triangle, paused off screen. Reduced motion: one static frame.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { damp } from "@/lib/design/motion";
import { useReducedMotion } from "../motion/use-reduced-motion";
import { useCanvasVisibility } from "./use-canvas-visibility";
import { themeTokens, useClosestTheme } from "./use-closest-theme";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uMouse;
  uniform vec3 uBg;
  uniform vec3 uPrimary;
  uniform vec3 uAccent;
  uniform float uIntensity;
  varying vec2 vUv;

  // value noise + fbm (3 octaves): cheap and smooth
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0) * 2.2;
    float t = uTime * 0.035;
    vec2 m = uMouse * 0.35;

    // domain warping: fluid, slow
    vec2 q = vec2(fbm(p + vec2(0.0, t) + m), fbm(p + vec2(5.2, -t) - m * 0.5));
    vec2 r = vec2(fbm(p + 3.0 * q + vec2(1.7, 9.2) + t * 0.6), fbm(p + 3.0 * q + vec2(8.3, 2.8) - t * 0.4));
    float f = fbm(p + 2.6 * r);

    vec3 col = uBg;
    col = mix(col, uPrimary, smoothstep(0.3, 0.9, f) * 0.62 * uIntensity);
    col = mix(col, uAccent, smoothstep(0.45, 0.95, r.y * f * 1.7) * 0.36 * uIntensity);

    // light that follows the mouse, very soft
    float glow = exp(-3.2 * length((uv - 0.5 - uMouse * vec2(0.5, -0.5) * 0.6) * vec2(uRes.x / uRes.y, 1.0)));
    col += uPrimary * glow * 0.08 * uIntensity;

    // vignette toward the base colour, and dithering against banding
    float vig = smoothstep(1.4, 0.15, length((uv - 0.5) * vec2(1.15, 1.0)));
    col = mix(uBg, col, vig);
    col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

type Palette = { bg: string; primary: string; accent: string };

function Plane({ palette, light, reduced }: { palette: Palette; light: boolean; reduced: boolean }) {
  const { size, invalidate } = useThree();
  const mouse = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uTime: { value: 12 },
          uRes: { value: new THREE.Vector2(1, 1) },
          uMouse: { value: new THREE.Vector2() },
          uBg: { value: new THREE.Color() },
          uPrimary: { value: new THREE.Color() },
          uAccent: { value: new THREE.Color() },
          uIntensity: { value: 1 },
        },
      }),
    [],
  );
  // One triangle that covers the screen.
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    return g;
  }, []);

  useEffect(() => {
    material.uniforms.uBg!.value = new THREE.Color(palette.bg);
    material.uniforms.uPrimary!.value = new THREE.Color(palette.primary);
    material.uniforms.uAccent!.value = new THREE.Color(palette.accent);
    material.uniforms.uIntensity!.value = light ? 0.45 : 1;
    invalidate();
  }, [palette, light, material, invalidate]);

  useEffect(() => {
    material.uniforms.uRes!.value.set(size.width, size.height);
    invalidate();
  }, [size, material, invalidate]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouse.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => () => {
    material.dispose();
    geometry.dispose();
  }, [material, geometry]);

  useFrame((_, delta) => {
    if (reduced) return;
    const dt = Math.min(delta, 0.05);
    const m = mouse.current;
    m.x = damp(m.x, m.tx, 0.12, dt);
    m.y = damp(m.y, m.ty, 0.12, dt);
    material.uniforms.uTime!.value += dt;
    (material.uniforms.uMouse!.value as THREE.Vector2).set(m.x, m.y);
  });

  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
}

export default function ShaderBackground({ className }: { className?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const theme = useClosestTheme(host);
  const reduced = useReducedMotion();
  const visible = useCanvasVisibility(host);
  const palette = useMemo<Palette>(() => themeTokens(theme, ["bg", "primary", "accent"] as const), [theme]);

  const frameloop = !visible ? "never" : reduced ? "demand" : "always";

  return (
    <div ref={host} aria-hidden="true" className={className} style={{ position: "absolute", inset: 0, overflow: "hidden" }} data-frameloop={frameloop}>
      {(
        <Canvas
          dpr={0.4}
          frameloop={frameloop}
          gl={{ antialias: false, alpha: false, powerPreference: "high-performance", depth: false, stencil: false }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Plane palette={palette} light={theme === "light"} reduced={reduced} />
        </Canvas>
      )}
    </div>
  );
}
