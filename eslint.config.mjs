import next from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  { ignores: ["reference/**", ".next/**", "node_modules/**", "next-env.d.ts"] },
  {
    // 3D stays in components/platform/three so no other page bundles it.
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/platform/three/**", "scripts/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { regex: "^(three|three/.*|@react-three/.*|gsap)$", message: "3D code lives in components/platform/three and is lazy-loaded (use three/lazy)." },
            { group: ["**/reference/**"], message: "Never import from reference/; copy and adapt." },
          ],
        },
      ],
    },
  },
  {
    // Imperative WebGL: three.js materials, uniforms and geometries are
    // mutable engine objects, updated in effects and the frame loop by design.
    files: ["components/platform/three/**"],
    rules: { "react-hooks/immutability": "off" },
  },
];
export default config;
