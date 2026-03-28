"use client";

import { useCallback, useEffect, useState } from "react";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { api, getToken } from "@/lib/api";
import { ResolveBox } from "./ResolveBox";

type ConcernsRes = {
  posts: FeedPost[];
  page: number;
  limit: number;
  total: number;
};

export default function LeaderConcernsPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"all" | "open" | "resolved">("open");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditBanner, setCreditBanner] = useState<string | null>(null);
  const limit = 15;

  const load = useCallback(async () => {
    if (!getToken()) {
      setErr("Sign in with a leader account to view concerns tagged to you.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status,
      });
      const d = await api<ConcernsRes>(`/leaders/me/concerns?${q}`);
      setPosts(d.posts);
      setTotal(d.total);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      {creditBanner && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          {creditBanner}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Concerns for you</h1>
        <p className="mt-1 text-sm text-slate-500">
          Issues where citizens tagged you or your office in the escalation chain. Order: highest upvote count first,
          then score, then newest. Resolve with a short public update — it appears on the feed for everyone following
          the thread.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-400">
          Status{" "}
          <select
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as "all" | "open" | "resolved");
            }}
            className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-slate-200"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </label>
        <span className="text-xs text-slate-600">{total} total</span>
      </div>

      {loading && <p className="text-slate-500">Loading…</p>}
      {err && <p className="text-rose-400">{err}</p>}

      {!loading && !err && posts.length === 0 && (
        <p className="text-slate-500">No concerns in this view.</p>
      )}

      <div className="flex flex-col gap-8">
        {posts.map((p) => (
          <div key={p.id} className="border-b border-slate-800/80 pb-8 last:border-0">
            <PostCard post={p} />
            {!p.resolvedAt && (
              <ResolveBox
                postId={p.id}
                onCreditMessage={setCreditBanner}
                onResolved={() => void load()}
              />
            )}
          </div>
        ))}
      </div>

      {total > limit && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((x) => Math.max(1, x - 1))}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page * limit >= total}
            onClick={() => setPage((x) => x + 1)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
