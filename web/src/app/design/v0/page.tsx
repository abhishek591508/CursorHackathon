"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

const MIN_LEN = 20;
const MAX_LEN = 900;

type V0SketchResponse = {
  source: string;
  webUrl: string;
  demoUrl: string | null;
  versionStatus: string | null;
  files: { name: string; content: string }[];
  hint: string;
};

export default function V0DesignPage() {
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<V0SketchResponse | null>(null);

  useEffect(() => {
    setSignedIn(!!getToken());
    setAuthReady(true);
  }, []);

  const len = prompt.trim().length;
  const canSubmit =
    signedIn && len >= MIN_LEN && len <= MAX_LEN && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setResult(null);
    if (!getToken()) {
      setErr("Sign in to use v0 UI sketch.");
      return;
    }
    setBusy(true);
    try {
      const r = await api<V0SketchResponse>("/v0/ui-sketch", {
        method: "POST",
        json: { prompt: prompt.trim() },
      });
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">v0 UI sketch</h1>
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">v0 UI sketch</h1>
        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-5 text-amber-100/90">
          <p className="font-medium">Sign in required</p>
          <p className="mt-1 text-sm text-amber-200/70">
            The API uses your account for rate limits.{" "}
            <Link href="/login" className="underline">
              Sign in
            </Link>{" "}
            or{" "}
            <Link href="/register" className="underline">
              register
            </Link>
            .
          </p>
        </div>
        <p className="text-sm text-slate-500">
          Server needs <code className="text-slate-400">V0_API_KEY</code> (v0.dev → Settings → API keys).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">v0 UI sketch</h1>
        <p className="mt-1 text-sm text-slate-500">
          Describe a screen or component; v0 returns a chat link and generated file snippets. Copy into{" "}
          <code className="text-slate-400">web/src</code> as needed.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block text-sm font-medium text-slate-300">
          Prompt ({MIN_LEN}–{MAX_LEN} characters)
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={8}
          className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          placeholder="e.g. A mobile-first card list for civic issues with tag chips, trust score, and a resolve button for leaders…"
        />
        <p className="text-xs text-slate-500">
          {len < MIN_LEN
            ? `${MIN_LEN - len} more characters needed`
            : len > MAX_LEN
              ? `${len - MAX_LEN} over limit`
              : "Ready to send"}
        </p>
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Generating…" : "Generate with v0"}
        </button>
      </form>

      {err && (
        <p className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
          {err}
        </p>
      )}

      {result && (
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Result</p>
          <p className="text-sm text-slate-400">{result.hint}</p>
          <div className="flex flex-wrap gap-3">
            <a
              href={result.webUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-violet-700 px-3 py-2 text-sm font-medium text-white hover:bg-violet-600"
            >
              Open v0 chat
            </a>
            {result.demoUrl && (
              <a
                href={result.demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
              >
                Demo preview
              </a>
            )}
          </div>
          {result.versionStatus && (
            <p className="text-xs text-slate-500">Version status: {result.versionStatus}</p>
          )}
          {result.files.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300">Files</p>
              {result.files.map((f) => (
                <details key={f.name} className="rounded-lg border border-slate-800 bg-slate-950/50">
                  <summary className="cursor-pointer px-3 py-2 text-sm text-cyan-400 hover:text-cyan-300">
                    {f.name}
                  </summary>
                  <pre className="max-h-80 overflow-auto border-t border-slate-800 p-3 text-[11px] leading-relaxed text-slate-400">
                    {f.content}
                  </pre>
                </details>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
