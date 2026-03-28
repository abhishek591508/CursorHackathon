"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isFeedAudioItem,
  isFeedImageItem,
  isFeedVideoItem,
  resolveMediaDeliveryUrl,
} from "@/lib/cloudinaryUpload";
import { PostRelatedSearch } from "@/components/PostRelatedSearch";
import { api, ensureAnonSession, getToken } from "@/lib/api";

export type PostMediaItem = {
  kind: string;
  storageKey: string;
  cdnUrl?: string | null;
  mimeType?: string;
  sizeBytes?: number;
};

export type FeedPost = {
  id: string;
  title: string;
  body: string;
  voteScore: number;
  commentCount: number;
  upvoteCount?: number;
  downvoteCount?: number;
  placeLabel?: string | null;
  districtKey?: string | null;
  villageLabel?: string | null;
  issueTags?: string[];
  isAnonymous: boolean;
  moderationStatus?: string;
  aiFlagged?: boolean;
  media?: PostMediaItem[];
  resolvedAt?: string | null;
  resolvedByLeaderProfileId?: string | null;
  resolvedByLeaderName?: string | null;
  resolutionSummary?: string | null;
  resolutionProofMedia?: PostMediaItem[];
};

export function PostMediaGallery({ items }: { items: PostMediaItem[] }) {
  return (
    <div className="mt-3 space-y-3">
      {items.map((m, i) => {
        const url = resolveMediaDeliveryUrl(m);
        if (!url) return null;
        if (isFeedImageItem(m)) {
          return (
            <a
              key={`${m.storageKey}-${i}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-slate-800 bg-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="max-h-72 w-full object-contain"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            </a>
          );
        }
        if (isFeedVideoItem(m)) {
          return (
            <video
              key={`${m.storageKey}-${i}`}
              src={url}
              controls
              className="max-h-72 w-full rounded-lg border border-slate-800 bg-black"
            />
          );
        }
        if (isFeedAudioItem(m)) {
          return (
            <audio
              key={`${m.storageKey}-${i}`}
              src={url}
              controls
              className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2"
            />
          );
        }
        return (
          <a
            key={`${m.storageKey}-${i}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-emerald-400 hover:bg-slate-800"
          >
            Download / open ({m.kind}
            {m.mimeType ? ` · ${m.mimeType}` : ""})
          </a>
        );
      })}
    </div>
  );
}

type VoteRes = {
  postId: string;
  upvoteCount: number;
  downvoteCount: number;
  voteScore: number;
  yourVote: number;
};

type CommentRow = {
  id: string;
  body: string;
  isAnonymous: boolean;
  authorUserId: string | null;
  voteScore: number;
  createdAt: string;
  depth: number;
  parentCommentId: string | null;
};

export function PostCard({
  post,
  onVoteSuccess,
}: {
  post: FeedPost;
  /** e.g. refetch feed when sorting by most upvotes */
  onVoteSuccess?: () => void;
}) {
  const [voteScore, setVoteScore] = useState(post.voteScore);
  const [upvoteCount, setUpvoteCount] = useState(post.upvoteCount ?? 0);
  const [downvoteCount, setDownvoteCount] = useState(post.downvoteCount ?? 0);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [yourVote, setYourVote] = useState<number | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [voteErr, setVoteErr] = useState<string | null>(null);

  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<CommentRow[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsErr, setCommentsErr] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentAnon, setCommentAnon] = useState(false);
  const [commentBusy, setCommentBusy] = useState(false);
  const [commentErr, setCommentErr] = useState<string | null>(null);

  useEffect(() => {
    setVoteScore(post.voteScore);
    setUpvoteCount(post.upvoteCount ?? 0);
    setDownvoteCount(post.downvoteCount ?? 0);
    setCommentCount(post.commentCount);
    setYourVote(null);
    setComments(null);
    setExpanded(false);
  }, [
    post.id,
    post.voteScore,
    post.upvoteCount,
    post.downvoteCount,
    post.commentCount,
  ]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    setCommentsErr(null);
    try {
      const r = await api<{ comments: CommentRow[] }>(`/posts/${post.id}/comments`);
      setComments(r.comments);
    } catch (e) {
      setCommentsErr((e as Error).message);
    } finally {
      setCommentsLoading(false);
    }
  }, [post.id]);

  useEffect(() => {
    if (expanded && comments === null && !commentsLoading) {
      void loadComments();
    }
  }, [expanded, comments, commentsLoading, loadComments]);

  async function sendVote(value: 1 | -1) {
    ensureAnonSession();
    setVoteErr(null);
    setVoteBusy(true);
    try {
      const r = await api<VoteRes>(`/posts/${post.id}/vote`, {
        method: "POST",
        json: { value },
      });
      setVoteScore(r.voteScore);
      setUpvoteCount(r.upvoteCount);
      setDownvoteCount(r.downvoteCount);
      setYourVote(r.yourVote);
      onVoteSuccess?.();
    } catch (e) {
      setVoteErr((e as Error).message);
    } finally {
      setVoteBusy(false);
    }
  }

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) return;
    ensureAnonSession();
    setCommentErr(null);
    setCommentBusy(true);
    try {
      const json: { body: string; isAnonymous?: boolean } = { body: text };
      if (getToken() && commentAnon) {
        json.isAnonymous = true;
      }
      await api<{ comment: CommentRow }>(`/posts/${post.id}/comments`, {
        method: "POST",
        json,
      });
      setNewComment("");
      setCommentCount((c) => c + 1);
      await loadComments();
    } catch (e) {
      setCommentErr((e as Error).message);
    } finally {
      setCommentBusy(false);
    }
  }

  const upActive = yourVote === 1;
  const downActive = yourVote === -1;

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg shadow-black/20 transition hover:border-slate-700">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        {post.resolvedAt && (
          <span className="rounded-full bg-emerald-950/90 px-2 py-0.5 font-medium text-emerald-300 ring-1 ring-emerald-700/50">
            Resolved
            {post.resolvedByLeaderName ? ` · ${post.resolvedByLeaderName}` : ""}
          </span>
        )}
        {post.placeLabel && (
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">
            {post.placeLabel}
          </span>
        )}
        {post.villageLabel && (
          <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-slate-400">
            {post.villageLabel}
          </span>
        )}
        {post.issueTags && post.issueTags.length > 0 && (
          <span className="text-slate-500">
            {post.issueTags.map((t) => (
              <span
                key={t}
                className="mr-1 inline-block rounded bg-slate-800/60 px-1.5 py-0.5 text-slate-400"
              >
                #{t}
              </span>
            ))}
          </span>
        )}
        {post.isAnonymous && <span className="text-amber-400/90">Anonymous</span>}
        {post.moderationStatus && post.moderationStatus !== "approved" && (
          <span className="text-amber-500">Review: {post.moderationStatus}</span>
        )}
        {post.aiFlagged && <span className="text-rose-400">AI flag</span>}
        {post.media && post.media.length > 0 && (
          <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-emerald-400/90">
            {post.media.length} attachment{post.media.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <h2 className="text-lg font-semibold text-slate-50">{post.title}</h2>
      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">
        {post.body}
      </p>
      {post.resolvedAt && post.resolutionSummary && (
        <div className="mt-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-3 py-3 text-sm text-emerald-100/90">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-500/90">
            Progress / resolution
          </p>
          <p className="mt-1 whitespace-pre-wrap text-emerald-100/85">{post.resolutionSummary}</p>
          {post.resolutionProofMedia && post.resolutionProofMedia.length > 0 && (
            <div className="mt-3 border-t border-emerald-900/30 pt-3">
              <p className="mb-2 text-xs font-medium text-emerald-500/80">Proof of work</p>
              <PostMediaGallery items={post.resolutionProofMedia} />
            </div>
          )}
        </div>
      )}
      {post.media && post.media.length > 0 && <PostMediaGallery items={post.media} />}

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800/80 pt-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void sendVote(1)}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium transition disabled:opacity-50 ${
              upActive
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            title="Upvote"
          >
            ▲
          </button>
          <span className="min-w-[2rem] text-center text-sm font-semibold text-slate-200">
            {voteScore}
          </span>
          <button
            type="button"
            disabled={voteBusy}
            onClick={() => void sendVote(-1)}
            className={`rounded-lg px-2.5 py-1 text-sm font-medium transition disabled:opacity-50 ${
              downActive
                ? "bg-rose-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            title="Downvote"
          >
            ▼
          </button>
        </div>
        <span className="text-xs text-slate-500">
          {upvoteCount}↑ · {downvoteCount}↓
        </span>
        <button
          type="button"
          onClick={() => {
            setExpanded((x) => {
              if (x) setComments(null);
              return !x;
            });
          }}
          className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          {expanded ? "Hide comments" : `${commentCount} comments`}
        </button>
      </div>
      {voteErr && <p className="mt-2 text-xs text-rose-400">{voteErr}</p>}

      {expanded && (
        <div className="mt-4 space-y-4 border-t border-slate-800/80 pt-4">
          <PostRelatedSearch postId={post.id} />
          <form onSubmit={submitComment} className="space-y-2">
            <textarea
              className="min-h-20 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              placeholder="Write a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={10000}
            />
            {getToken() && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={commentAnon}
                  onChange={(e) => setCommentAnon(e.target.checked)}
                />
                Post comment anonymously
              </label>
            )}
            {commentErr && <p className="text-xs text-rose-400">{commentErr}</p>}
            <button
              type="submit"
              disabled={commentBusy || !newComment.trim()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {commentBusy ? "Posting…" : "Post comment"}
            </button>
          </form>

          {commentsLoading && <p className="text-sm text-slate-500">Loading comments…</p>}
          {commentsErr && <p className="text-sm text-rose-400">{commentsErr}</p>}
          {comments && comments.length === 0 && !commentsLoading && (
            <p className="text-sm text-slate-600">No comments yet.</p>
          )}
          {comments && comments.length > 0 && (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2"
                  style={{ marginLeft: Math.min(c.depth, 8) * 12 }}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                    {c.isAnonymous ? (
                      <span className="text-amber-400/80">Anonymous</span>
                    ) : (
                      <span>User</span>
                    )}
                    <span className="text-slate-600">· {c.voteScore} pts</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
