/** Data mode (spec 4): `demo` (default) or `api`. Only `lib/api/*` reads it; pages never branch on it. */
export const DATA_MODE: "demo" | "api" = process.env.NEXT_PUBLIC_DATA_MODE === "api" ? "api" : "demo";
export const IS_DEMO = DATA_MODE === "demo";
