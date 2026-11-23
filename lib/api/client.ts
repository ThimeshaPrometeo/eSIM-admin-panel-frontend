/**
 * The one way to the server (CONVENTIONS §3): `/api/v1/*` on our own origin,
 * cookies included. 401 signs out (redirect to sign-in with ?next=); other
 * errors become ApiError from `{ error: { code, message, details } }`.
 */
import { ApiError } from "./errors";

type Query = Record<string, string | number | boolean | null | undefined>;

function url(path: string, query?: Query) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const qs = q.toString();
  return `/api/v1${path}${qs ? `?${qs}` : ""}`;
}

async function request(path: string, init: { method?: string; body?: unknown; query?: Query; headers?: Record<string, string> } = {}) {
  let res: Response;
  try {
    res = await fetch(url(path, init.query), {
      method: init.method ?? "GET",
      credentials: "include",
      headers: { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.replace(`/?next=${next}`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null;
    throw new ApiError(res.status, body?.error?.code ?? (res.status === 403 ? "FORBIDDEN" : res.status === 404 ? "NOT_FOUND" : `HTTP_${res.status}`), body?.error?.message, body?.error?.details);
  }
  return res;
}

export async function apiFetch<T>(path: string, init: Parameters<typeof request>[1] = {}): Promise<T> {
  const res = await request(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiFetchBlob(path: string, init: Parameters<typeof request>[1] = {}): Promise<Blob> {
  return (await request(path, init)).blob();
}
