"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, setAuthSession, type PublicUser } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{ token: string; user: PublicUser }>("/auth/login", {
        method: "POST",
        json: { email, password },
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
        <h1 className="text-2xl font-bold text-white">Sign in</h1>
        <p className="mt-1 text-sm text-slate-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-emerald-400 hover:text-emerald-300">
            Create an account
          </Link>{" "}
          first.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <p className="text-sm text-rose-400">{err}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-500">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-emerald-400 hover:text-emerald-300">
          Register
        </Link>
      </p>
    </div>
  );
}
