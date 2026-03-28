export const CIVIC_AUTH_CHANGED = "civic-auth-changed";

/** Thrown by {@link api} on non-OK responses; inspect `status` and `payload` for structured errors (e.g. 409 similar post). */
export class ApiError extends Error {
  readonly status: number;
  /** Parsed JSON body from the server (shape varies by endpoint). */
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

function notifyAuthChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CIVIC_AUTH_CHANGED));
}

const base = () =>
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(t: string) {
  localStorage.setItem("token", t);
  notifyAuthChanged();
}

/** Mirrors backend `PublicUser` (dates arrive as ISO strings from JSON). */
export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  /** Public handle for tagging (null for older accounts). */
  userHandle?: string | null;
  role: string;
  trustScore?: number;
  trustScoreUpdatedAt?: string | null;
  leaderProfileId?: string | null;
  emailVerifiedAt?: string | null;
  createdAt?: string;
};

const USER_KEY = "civic_user";

export function persistStoredUser(user: PublicUser) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setAuthSession(token: string, user: PublicUser) {
  localStorage.setItem("token", token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifyAuthChanged();
}

export function getStoredUser(): PublicUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PublicUser;
  } catch {
    return null;
  }
}

/** Clears JWT + stored profile (does not remove anonymous session). */
export function clearAuthSession() {
  localStorage.removeItem("token");
  localStorage.removeItem(USER_KEY);
  notifyAuthChanged();
}

export function setAnonSession(id: string) {
  localStorage.setItem("anonSession", id);
}

export function getAnonSession(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("anonSession");
}

/** Ensures voting / commenting works when not logged in (X-Anonymous-Session). */
export function ensureAnonSession() {
  if (typeof window === "undefined") return;
  if (!getToken() && !getAnonSession()) {
    const a = crypto.randomUUID().replace(/-/g, "");
    const b = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    setAnonSession(a + b);
  }
}

export async function api<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const tok = typeof window !== "undefined" ? getToken() : null;
  if (tok) headers.set("Authorization", `Bearer ${tok}`);
  const anon = typeof window !== "undefined" ? localStorage.getItem("anonSession") : null;
  if (anon) headers.set("X-Anonymous-Session", anon);

  let body = init?.body;
  if (init?.json !== undefined) {
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${base()}/api${path}`, {
    ...init,
    headers,
    body,
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!res.ok) {
    const errBody = (data as {
      error?: {
        message?: string;
        details?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | unknown> };
      };
    }).error;
    let msg = errBody?.message ?? `Request failed ${res.status}`;
    const fe = errBody?.details?.fieldErrors;
    if (fe && typeof fe === "object") {
      const bits: string[] = [];
      for (const [k, v] of Object.entries(fe)) {
        if (Array.isArray(v) && v.length) bits.push(`${k}: ${v.join(", ")}`);
      }
      if (bits.length) msg = `${msg} (${bits.join("; ")})`;
    }
    const formErr = errBody?.details?.formErrors;
    if (Array.isArray(formErr) && formErr.length) {
      msg = `${msg} ${formErr.join(" ")}`;
    }
    throw new ApiError(msg.trim(), res.status, data);
  }
  return data as T;
}
