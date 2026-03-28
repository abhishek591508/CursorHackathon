"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setAuthSession, type PublicUser } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userHandle, setUserHandle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: PublicUser }>("/auth/register", {
        method: "POST",
        json: { email, password, displayName, userHandle: userHandle.trim() },
      });
      setAuthSession(res.token, res.user);
      router.push("/dashboard");
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Create account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Register first, then you can log in anytime from any device.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Display name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          minLength={1}
          maxLength={120}
          autoComplete="name"
        />
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Public user id (unique, e.g. priya-sharma or ward12-mc)"
          value={userHandle}
          onChange={(e) => setUserHandle(e.target.value)}
          required
          minLength={3}
          maxLength={32}
          pattern="[a-zA-Z0-9][a-zA-Z0-9_-]*"
          title="Letters, numbers, underscores, hyphens; start with a letter or number"
          autoComplete="username"
        />
        <p className="text-xs text-slate-500">
          This id is yours forever — others use it to tag you when you are a leader. If it is taken, pick another.
        </p>
        <input
          type="email"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
        />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
          Sign in
        </Link>
      </p>
    </div>
  );
}
