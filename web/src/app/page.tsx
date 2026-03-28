"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { api, ensureAnonSession } from "@/lib/api";

type FeedSort = "top" | "balanced" | "nearest" | "hot" | "recent";

type FeedRes = { posts: FeedPost[] };

function buildFeedQuery(params: {
  lng: number;
  lat: number;
  radiusKm: number;
  limit: number;
  sort: FeedSort;
  tags: string;
  excludeResolved: boolean;
  minUpvotes: string;
}): string {
  const q = new URLSearchParams();
  q.set("lng", String(params.lng));
  q.set("lat", String(params.lat));
  q.set("radiusKm", String(params.radiusKm));
  q.set("limit", String(params.limit));
  q.set("sort", params.sort);
  if (params.tags.trim()) q.set("tags", params.tags.trim());
  if (params.excludeResolved) q.set("excludeResolved", "true");
  const mu = params.minUpvotes.trim();
  if (mu && !Number.isNaN(Number(mu))) q.set("minUpvotes", mu);
  return q.toString();
}

export default function HomePage() {
  const [posts, setPosts] = useState<FeedRes["posts"]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [feedNotice, setFeedNotice] = useState<string | null>(null);
  const noticeLoadedRef = useRef(false);

  const [lng, setLng] = useState(77.209);
  const [lat, setLat] = useState(28.6139);
  const [radiusKm, setRadiusKm] = useState(80);
  const [limit, setLimit] = useState(24);
  const [sort, setSort] = useState<FeedSort>("top");
  const [tags, setTags] = useState("");
  const [excludeResolved, setExcludeResolved] = useState(false);
  const [minUpvotes, setMinUpvotes] = useState("");

  const queryString = useMemo(
    () =>
      buildFeedQuery({
        lng,
        lat,
        radiusKm,
        limit,
        sort,
        tags,
        excludeResolved,
        minUpvotes,
      }),
    [lng, lat, radiusKm, limit, sort, tags, excludeResolved, minUpvotes],
  );

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const d = await api<FeedRes>(`/feed?${queryString}`);
      setPosts(d.posts);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    ensureAnonSession();
    if (!noticeLoadedRef.current) {
      noticeLoadedRef.current = true;
      try {
        const n = sessionStorage.getItem("civic_feed_notice");
        if (n) {
          setFeedNotice(n);
          sessionStorage.removeItem("civic_feed_notice");
        }
      } catch {
        /* ignore */
      }
    }
    void loadFeed();
  }, [loadFeed]);

  function requestBrowserLocation() {
    setGeoHint(null);
    if (!navigator.geolocation) {
      setGeoHint("Geolocation is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLng(Number(pos.coords.longitude.toFixed(5)));
        setLat(Number(pos.coords.latitude.toFixed(5)));
        if (pos.coords.accuracy) {
          setGeoHint(`Accuracy ~${Math.round(pos.coords.accuracy)} m`);
        }
      },
      () => setGeoHint("Could not read location (permission denied or unavailable)."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  return (
    <div className="space-y-6">
      {feedNotice && (
        <div className="rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100">
          {feedNotice}
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Nearby feed</h1>
        <p className="mt-1 text-sm text-slate-500">
          Default: most upvotes first (within your radius). Other modes mix distance, engagement, trending,
          and recency.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => requestBrowserLocation()}
            className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Use my location
          </button>
          <span className="text-xs text-slate-500">then adjust radius & sort</span>
        </div>
        {geoHint && <p className="mt-2 text-xs text-slate-400">{geoHint}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs text-slate-500">
            Longitude
            <input
              type="text"
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Latitude
            <input
              type="text"
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(Number(e.target.value) || 0)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Radius (km)
            <input
              type="number"
              min={1}
              max={200}
              value={radiusKm}
              onChange={(e) => setRadiusKm(Number(e.target.value) || 25)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Max posts
            <input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 20)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block text-xs text-slate-500">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as FeedSort)}
              className="mt-1 block w-52 rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm text-slate-200"
            >
              <option value="top">Most upvotes (top)</option>
              <option value="balanced">Balanced (near + engagement)</option>
              <option value="nearest">Nearest first</option>
              <option value="hot">Hot (engagement + trending)</option>
              <option value="recent">Newest</option>
            </select>
          </label>
          <label className="block min-w-[10rem] flex-1 text-xs text-slate-500">
            Tags (comma-separated, match #hashtags)
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="roads, water, streetlight"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-600"
            />
          </label>
          <label className="block text-xs text-slate-500">
            Min upvotes
            <input
              value={minUpvotes}
              onChange={(e) => setMinUpvotes(e.target.value)}
              placeholder="0"
              className="mt-1 w-20 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-200"
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={excludeResolved}
              onChange={(e) => setExcludeResolved(e.target.checked)}
            />
            Hide resolved
          </label>
          <button
            type="button"
            onClick={() => void loadFeed()}
            className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
          >
            Apply
          </button>
        </div>
      </div>

      {loading && <p className="text-center text-slate-500">Loading feed…</p>}
      {!loading && err && (
        <p className="rounded-xl border border-rose-900/50 bg-rose-950/30 p-4 text-rose-300">
          {err} — check NEXT_PUBLIC_API_URL and that the API is running.
        </p>
      )}
      {!loading && !err && (
        <div className="flex flex-col gap-4">
          {posts.length === 0 ? (
            <p className="text-slate-500">No posts match these filters. Try a larger radius or different tags.</p>
          ) : (
            posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                onVoteSuccess={sort === "top" ? () => void loadFeed() : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
