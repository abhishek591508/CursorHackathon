"use client";

import { useState } from "react";
import { api, getToken } from "@/lib/api";

type Hit = { title: string; url: string; description: string | null };

type ApifyRes = {
  query: string;
  source: string;
  actorId: string;
  disclaimer: string;
  results: Hit[];
};

type ExaRes = {
  query: string;
  source: string;
  disclaimer: string;
  results: Hit[];
};

export function PostRelatedSearch({ postId }: { postId: string }) {
  const [apifyBusy, setApifyBusy] = useState(false);
  const [exaBusy, setExaBusy] = useState(false);
  const [apifyErr, setApifyErr] = useState<string | null>(null);
  const [exaErr, setExaErr] = useState<string | null>(null);
  const [apifyData, setApifyData] = useState<ApifyRes | null>(null);
  const [exaData, setExaData] = useState<ExaRes | null>(null);

  if (!getToken()) {
    return (
      <p className="text-xs text-slate-600">
        Sign in to load related web results (Apify &amp; Exa).
      </p>
    );
  }

  async function runApify() {
    setApifyErr(null);
    setApifyBusy(true);
    try {
      const r = await api<ApifyRes>("/apify/related-web", {
        method: "POST",
        json: { postId },
      });
      setApifyData(r);
    } catch (e) {
      setApifyData(null);
      setApifyErr((e as Error).message);
    } finally {
      setApifyBusy(false);
    }
  }

  async function runExa() {
    setExaErr(null);
    setExaBusy(true);
    try {
      const r = await api<ExaRes>("/exa/related-web", {
        method: "POST",
        json: { postId },
      });
      setExaData(r);
    } catch (e) {
      setExaData(null);
      setExaErr((e as Error).message);
    } finally {
      setExaBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-3">
      <p className="text-xs font-medium text-slate-400">Related on the web</p>
      <p className="text-[11px] leading-snug text-slate-600">
        Optional context from third-party APIs. Configure server keys:{" "}
        <code className="text-slate-500">APIFY_TOKEN</code>,{" "}
        <code className="text-slate-500">EXA_API_KEY</code>.
      </p>

      <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-violet-200/90">Apify (Google SERP)</span>
          <button
            type="button"
            disabled={apifyBusy}
            onClick={() => void runApify()}
            className="rounded-lg bg-violet-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-violet-600 disabled:opacity-50"
          >
            {apifyBusy ? "…" : "Run"}
          </button>
        </div>
        {apifyErr && <p className="mt-1 text-[11px] text-rose-400">{apifyErr}</p>}
        {apifyData && (
          <ResultList
            disclaimer={apifyData.disclaimer}
            query={apifyData.query}
            results={apifyData.results}
            accent="violet"
          />
        )}
      </div>

      <div className="rounded-lg border border-sky-900/40 bg-sky-950/20 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-sky-200/90">Exa (semantic search)</span>
          <button
            type="button"
            disabled={exaBusy}
            onClick={() => void runExa()}
            className="rounded-lg bg-sky-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-600 disabled:opacity-50"
          >
            {exaBusy ? "…" : "Run"}
          </button>
        </div>
        {exaErr && <p className="mt-1 text-[11px] text-rose-400">{exaErr}</p>}
        {exaData && (
          <ResultList
            disclaimer={exaData.disclaimer}
            query={exaData.query}
            results={exaData.results}
            accent="sky"
          />
        )}
      </div>
    </div>
  );
}

function ResultList({
  disclaimer,
  query,
  results,
  accent,
}: {
  disclaimer: string;
  query: string;
  results: Hit[];
  accent: "violet" | "sky";
}) {
  const qColor = accent === "violet" ? "text-violet-200/70" : "text-sky-200/70";
  return (
    <div className="mt-2 space-y-2 border-t border-slate-800/60 pt-2">
      <p className={`text-[10px] ${qColor}`}>{disclaimer}</p>
      <p className="text-[10px] text-slate-500">
        Query: <span className="text-slate-400">{query}</span>
      </p>
      {results.length === 0 ? (
        <p className="text-[11px] text-slate-500">No results.</p>
      ) : (
        <ul className="space-y-2">
          {results.map((h) => (
            <li key={h.url} className="text-[11px]">
              <a
                href={h.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-cyan-400 hover:text-cyan-300"
              >
                {h.title}
              </a>
              {h.description && (
                <p className="mt-0.5 line-clamp-2 text-slate-500">{h.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
