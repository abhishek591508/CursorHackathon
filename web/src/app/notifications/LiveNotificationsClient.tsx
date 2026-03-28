"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import {
  CIVIC_AUTH_CHANGED,
  getStoredUser,
  getToken,
  type PublicUser,
} from "@/lib/api";

type ConnState = "idle" | "connecting" | "connected" | "disconnected" | "error";

type Row = {
  id: number;
  t: string;
  event: string;
  data: unknown;
};

const base =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";

const EVENT_STYLES: Record<string, string> = {
  connect: "text-emerald-400",
  disconnect: "text-amber-400",
  connect_error: "text-rose-400",
  notification: "text-sky-400",
  "post:comment": "text-violet-400",
  "feed:new": "text-cyan-400",
  "feed:resolved": "text-emerald-400",
  "trending:spike": "text-orange-400",
};

function nextId() {
  return Date.now() + Math.random();
}

export default function LiveNotificationsClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [conn, setConn] = useState<ConnState>("idle");
  const [lastError, setLastError] = useState<string | null>(null);
  const [postIdInput, setPostIdInput] = useState("");
  const [joinedPosts, setJoinedPosts] = useState<string[]>([]);
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const joinedPostsRef = useRef<string[]>([]);
  const [authTick, setAuthTick] = useState(0);

  useEffect(() => {
    joinedPostsRef.current = joinedPosts;
  }, [joinedPosts]);

  const push = useCallback((event: string, data: unknown) => {
    setRows((r) =>
      [
        {
          id: nextId(),
          t: new Date().toLocaleTimeString(),
          event,
          data,
        },
        ...r,
      ].slice(0, 120),
    );
  }, []);

  useEffect(() => {
    setProfile(getStoredUser());
    const onAuth = () => {
      setAuthTick((n) => n + 1);
      setProfile(getStoredUser());
    };
    window.addEventListener(CIVIC_AUTH_CHANGED, onAuth);
    return () => window.removeEventListener(CIVIC_AUTH_CHANGED, onAuth);
  }, []);

  useEffect(() => {
    let disposed = false;
    const created: { s: Socket | null } = { s: null };

    setConn("connecting");
    setLastError(null);
    const token = getToken();

    void import("socket.io-client")
      .then(({ io }) => {
        if (disposed) return;
        const s = io(base, {
          path: "/socket.io",
          auth: token ? { token } : {},
          transports: ["websocket", "polling"],
          reconnectionAttempts: 8,
          reconnectionDelay: 1000,
        });
        if (disposed) {
          s.removeAllListeners();
          s.disconnect();
          return;
        }
        created.s = s;
        socketRef.current = s;

        s.on("connect", () => {
          if (disposed) return;
          setConn("connected");
          setLastError(null);
          for (const id of joinedPostsRef.current) {
            s.emit("join:post", id);
          }
          push("connect", {
            id: s.id,
            authenticated: Boolean(token),
            rejoinedPosts: joinedPostsRef.current.length,
          });
        });

        s.on("disconnect", (reason) => {
          if (disposed) return;
          setConn("disconnected");
          push("disconnect", { reason });
        });

        s.on("connect_error", (err: Error) => {
          if (disposed) return;
          setConn("error");
          const msg = err.message || "Connection failed";
          setLastError(msg);
          push("connect_error", { message: msg });
        });

        s.on("notification", (data) => {
          if (!disposed) push("notification", data);
        });
        s.on("post:comment", (data) => {
          if (!disposed) push("post:comment", data);
        });
        s.on("feed:new", (data) => {
          if (!disposed) push("feed:new", data);
        });
        s.on("feed:resolved", (data) => {
          if (!disposed) push("feed:resolved", data);
        });
        s.on("trending:spike", (data) => {
          if (!disposed) push("trending:spike", data);
        });
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setConn("error");
        const msg = err instanceof Error ? err.message : "Failed to load socket client";
        setLastError(msg);
        push("connect_error", { message: msg });
      });

    return () => {
      disposed = true;
      socketRef.current = null;
      if (created.s) {
        created.s.removeAllListeners();
        created.s.disconnect();
        created.s = null;
      }
    };
  }, [authTick, push]);

  function joinPostRoom() {
    const id = postIdInput.trim();
    if (!/^[a-f\d]{24}$/i.test(id)) {
      setLastError("Enter a valid 24-character post id (Mongo ObjectId).");
      return;
    }
    const s = socketRef.current;
    if (!s?.connected) {
      setLastError("Socket not connected yet.");
      return;
    }
    s.emit("join:post", id);
    setJoinedPosts((prev) => (prev.includes(id) ? prev : [...prev, id]));
    push("client:join:post", { postId: id });
    setPostIdInput("");
    setLastError(null);
  }

  function leavePostRoom(id: string) {
    socketRef.current?.emit("leave:post", id);
    setJoinedPosts((prev) => prev.filter((p) => p !== id));
    push("client:leave:post", { postId: id });
  }

  function clearFeed() {
    setRows([]);
  }

  const connLabel =
    conn === "connected"
      ? "Connected"
      : conn === "connecting"
        ? "Connecting…"
        : conn === "error"
          ? "Error"
          : conn === "disconnected"
            ? "Disconnected"
            : "Idle";

  const connClass =
    conn === "connected"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : conn === "connecting"
        ? "bg-amber-500/15 text-amber-300 ring-amber-500/30"
        : conn === "error"
          ? "bg-rose-500/15 text-rose-300 ring-rose-500/30"
          : "bg-slate-500/15 text-slate-400 ring-slate-500/30";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Live stream</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Real-time events from{" "}
            <code className="rounded bg-slate-900 px-1 text-slate-400">{base}</code>. Global{" "}
            <code className="text-slate-400">feed:new</code>,{" "}
            <code className="text-slate-400">feed:resolved</code>; per-user{" "}
            <code className="text-slate-400">notification</code>; post rooms for{" "}
            <code className="text-slate-400">post:comment</code>. Admins also get{" "}
            <code className="text-slate-400">trending:spike</code>.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ${connClass}`}
          >
            {connLabel}
          </span>
          <p className="text-right text-xs text-slate-500">
            {getToken()
              ? profile
                ? `Listening as ${profile.displayName} (user room + post rooms you join).`
                : "JWT sent — user room active; profile loading…"
              : "Guest: global feed only. Sign in for your notification channel."}
          </p>
        </div>
      </div>

      {lastError && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {lastError}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="join-post" className="mb-1 block text-xs font-medium text-slate-500">
            Watch a post thread (24-char id)
          </label>
          <input
            id="join-post"
            value={postIdInput}
            onChange={(e) => setPostIdInput(e.target.value)}
            placeholder="e.g. 507f1f77bcf86cd799439011"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200 placeholder:text-slate-600"
          />
        </div>
        <button
          type="button"
          onClick={joinPostRoom}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Join room
        </button>
        <button
          type="button"
          onClick={clearFeed}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Clear feed
        </button>
      </div>

      {joinedPosts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-slate-500">Joined:</span>
          {joinedPosts.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300"
            >
              {id.slice(0, 8)}…
              <button
                type="button"
                onClick={() => leavePostRoom(id)}
                className="ml-1 text-rose-400 hover:text-rose-300"
                aria-label={`Leave ${id}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <ul className="max-h-[min(520px,55vh)] space-y-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/50 p-3 font-mono text-xs">
        {rows.length === 0 ? (
          <li className="py-8 text-center text-slate-600">Waiting for events…</li>
        ) : (
          rows.map((r) => {
            const style = EVENT_STYLES[r.event] ?? "text-slate-400";
            let payload: string;
            try {
              payload = JSON.stringify(r.data);
            } catch {
              payload = String(r.data);
            }
            return (
              <li key={r.id} className="border-b border-slate-800/80 py-2.5 last:border-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-slate-600">{r.t}</span>
                  <span className={`font-semibold ${style}`}>{r.event}</span>
                </div>
                <pre className="mt-1 whitespace-pre-wrap break-all text-slate-400">{payload}</pre>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
