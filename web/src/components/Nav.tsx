"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CIVIC_AUTH_CHANGED,
  api,
  clearAuthSession,
  getStoredUser,
  getToken,
  persistStoredUser,
  type PublicUser,
} from "@/lib/api";

const mainLinks = [
  { href: "/", label: "Feed" },
  { href: "/post/new", label: "New post" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/design/v0", label: "v0 UI" },
  { href: "/notifications", label: "Live" },
];

export function Nav() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [user, setUser] = useState<PublicUser | null>(null);

  const refreshAuth = useCallback(() => {
    const tok = getToken();
    setSignedIn(!!tok);
    const u = getStoredUser();
    setUser(u);
    if (tok && !u) {
      api<{ user: PublicUser }>("/auth/me")
        .then((r) => {
          setUser(r.user);
          persistStoredUser(r.user);
        })
        .catch((e) => {
          const msg = (e as Error).message ?? "";
          if (/\b401\b|\b403\b|Unauthorized|Forbidden/i.test(msg)) {
            clearAuthSession();
            setSignedIn(false);
            setUser(null);
            return;
          }
          setUser(null);
        });
    }
  }, []);

  useEffect(() => {
    refreshAuth();
    const onAuth = () => refreshAuth();
    window.addEventListener(CIVIC_AUTH_CHANGED, onAuth);
    return () => window.removeEventListener(CIVIC_AUTH_CHANGED, onAuth);
  }, [refreshAuth]);

  function logout() {
    clearAuthSession();
    setSignedIn(false);
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-semibold tracking-tight text-emerald-400">
          Civic<span className="text-slate-100">Pulse</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1 text-sm">
          {mainLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              {l.label}
            </Link>
          ))}
          {signedIn && user?.leaderProfileId && (
            <Link
              href="/leader/concerns"
              className="rounded-lg px-3 py-1.5 text-cyan-400/90 transition hover:bg-slate-800 hover:text-cyan-300"
            >
              My concerns
            </Link>
          )}
          {signedIn && user?.role === "user" && !user?.leaderProfileId && (
            <Link
              href="/apply-leader"
              className="rounded-lg px-3 py-1.5 text-amber-400/90 transition hover:bg-slate-800 hover:text-amber-300"
            >
              Become a leader
            </Link>
          )}
          {signedIn && (user?.role === "admin" || user?.role === "super_admin") && (
            <Link
              href="/admin/leaders"
              className="rounded-lg px-3 py-1.5 text-violet-400 transition hover:bg-slate-800 hover:text-violet-300"
            >
              Admin · Leaders
            </Link>
          )}
          {signedIn ? (
            <>
              <span
                className="hidden max-w-[160px] truncate px-2 text-slate-500 sm:inline"
                title={user?.email ?? "Signed in"}
              >
                {user?.displayName ? `Hi, ${user.displayName}` : "Signed in"}
              </span>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg px-3 py-1.5 font-medium text-emerald-400 transition hover:bg-slate-800 hover:text-emerald-300"
              >
                Register
              </Link>
              <Link
                href="/login"
                className="rounded-lg px-3 py-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-white"
              >
                Sign in
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}


