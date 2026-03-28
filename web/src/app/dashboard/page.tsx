"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getStoredUser, getToken, persistStoredUser, type PublicUser } from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    const tok = getToken();
    setSignedIn(!!tok);
    const local = getStoredUser();
    setUser(local);
    if (!tok) return;
    api<{ user: PublicUser }>("/auth/me")
      .then((r) => {
        setUser(r.user);
        persistStoredUser(r.user);
      })
      .catch(() => setMeError("Could not refresh profile (try signing in again)."));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Dashboard</h1>

      {signedIn === false ? (
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 text-amber-100/90">
          <p className="font-medium">You are not signed in</p>
          <p className="mt-1 text-sm text-amber-200/70">
            Register once, then sign in to sync notifications and post with your account.
            You can still browse the feed; some actions need{" "}
            <Link href="/register" className="underline">
              Register
            </Link>{" "}
            or{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>
            .
          </p>
        </div>
      ) : null}

      {user && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="text-lg font-semibold text-white">{user.displayName}</p>
          <p className="text-sm text-slate-400">{user.email}</p>
          {user.userHandle ? (
            <p className="mt-1 text-sm text-emerald-400/90">
              Public user id: <span className="font-mono text-emerald-300">@{user.userHandle}</span>
              {user.leaderProfileId ? " — citizens tag you with this when posting." : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-amber-200/80">
              No public user id on file (older account). New signups pick a unique id; contact support if you need one
              set to be tagged as a leader.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Role: {user.role} · Trust score: {user.trustScore ?? "—"}
          </p>
        </div>
      )}

      {meError && <p className="text-sm text-rose-400">{meError}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {user?.leaderProfileId && (
          <Link
            href="/leader/concerns"
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-cyan-700/50"
          >
            <h2 className="font-semibold text-cyan-400">Concerns for you</h2>
            <p className="mt-1 text-sm text-slate-500">
              Posts that tag your office — resolve and broadcast updates publicly.
            </p>
          </Link>
        )}
        <Link
          href="/post/new"
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-700/50"
        >
          <h2 className="font-semibold text-emerald-400">New issue</h2>
          <p className="mt-1 text-sm text-slate-500">Tag leaders, add location & media metadata.</p>
        </Link>
        <Link
          href="/notifications"
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-emerald-700/50"
        >
          <h2 className="font-semibold text-emerald-400">Live notifications</h2>
          <p className="mt-1 text-sm text-slate-500">Socket.io stream (tags, comments, trending).</p>
        </Link>
        <Link
          href="/design/v0"
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-violet-700/50"
        >
          <h2 className="font-semibold text-violet-400">v0 UI sketch</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generate UI with Vercel v0 (prompt → chat link + code snippets).
          </p>
        </Link>
      </div>
    </div>
  );
}
