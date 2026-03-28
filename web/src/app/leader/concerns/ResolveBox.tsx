"use client";

import { useRef, useState } from "react";
import type { FeedPost } from "@/components/PostCard";
import {
  isCloudinaryConfigured,
  uploadFileToCloudinary,
  type UploadedMediaForPost,
} from "@/lib/cloudinaryUpload";
import { api, CIVIC_AUTH_CHANGED, getToken, persistStoredUser, type PublicUser } from "@/lib/api";

const MAX_PROOF = 5;
const PROOF_ACCEPT = "image/*,video/*";
/** Kept in sync with backend `resolvePostSchema.resolutionSummary`. */
const MIN_SUMMARY = 10;

type ResolveRes = {
  post: FeedPost;
  leaderCredit: {
    upvotesCreditedFromPost: number;
    citizenSupportCreditTotal: number;
    concernsResolvedCount: number;
    resolutionsWithProofCount: number;
    hadProof: boolean;
    trustScoreAdded: number;
    trustScore: number;
  };
};

function toProofPayload(items: UploadedMediaForPost[]) {
  return items.map((m) => ({
    kind: m.kind as "image" | "video",
    storageKey: m.storageKey,
    cdnUrl: m.cdnUrl,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    width: m.width ?? null,
    height: m.height ?? null,
    durationSec: m.durationSec ?? null,
    processingStatus: "ready" as const,
  }));
}

export function ResolveBox({
  postId,
  onResolved,
  onCreditMessage,
}: {
  postId: string;
  onResolved: () => void;
  onCreditMessage?: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [proof, setProof] = useState<UploadedMediaForPost[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cloudReady = isCloudinaryConfigured();

  const summaryOk = text.trim().length >= MIN_SUMMARY;
  const canSubmit = summaryOk && !uploadBusy;

  async function onPickProof(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (picked.length === 0) return;
    if (!cloudReady) {
      setErr(
        "Cloudinary is not configured. Add NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET to web/.env.local and restart dev.",
      );
      return;
    }
    setErr(null);
    setUploadBusy(true);
    try {
      for (const file of picked) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
          continue;
        }
        const item = await uploadFileToCloudinary(file);
        if (item.kind !== "image" && item.kind !== "video") continue;
        setProof((p) => (p.length >= MAX_PROOF ? p : [...p, item]));
      }
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setUploadBusy(false);
    }
  }

  function removeProof(i: number) {
    setProof((p) => p.filter((_, idx) => idx !== i));
  }

  function tryResolve() {
    const summary = text.trim();
    if (uploadBusy) {
      setErr("Wait until the proof upload finishes, then click again.");
      return;
    }
    if (summary.length < MIN_SUMMARY) {
      setErr(
        `Step 1: write a bit more in the resolution box — at least ${MIN_SUMMARY} characters (you have ${summary.length}).`,
      );
      return;
    }
    void runResolve();
  }

  async function runResolve() {
    const summary = text.trim();
    setErr(null);
    setBusy(true);
    try {
      const res = await api<ResolveRes>(`/posts/${postId}/resolve`, {
        method: "POST",
        json: {
          resolutionSummary: summary,
          proofMedia: toProofPayload(proof),
        },
      });
      const c = res.leaderCredit;
      const trustBit =
        c.trustScoreAdded > 0
          ? ` Profile trust score +${c.trustScoreAdded} (now ${c.trustScore}/100, from this post’s upvotes). `
          : c.trustScore >= 100
            ? ` Profile trust score is capped at ${c.trustScore}/100. `
            : "";
      const msg =
        `Resolved. +${c.upvotesCreditedFromPost} citizen-support points from this post’s upvotes. ` +
        trustBit +
        `Your totals: ${c.citizenSupportCreditTotal} support credit · ${c.concernsResolvedCount} concerns closed` +
        (c.hadProof ? ` · ${c.resolutionsWithProofCount} with photo/video proof` : "") +
        ".";
      onCreditMessage?.(msg);
      if (getToken()) {
        try {
          const me = await api<{ user: PublicUser }>("/auth/me");
          persistStoredUser(me.user);
          window.dispatchEvent(new Event(CIVIC_AUTH_CHANGED));
        } catch {
          /* ignore */
        }
      }
      setText("");
      setProof([]);
      onResolved();
    } catch (er) {
      setErr((er as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-950/50 p-3">
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5">
        <p className="text-xs font-semibold text-amber-100/90">Before you broadcast</p>
        <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-amber-100/75">
          <li>
            Stay <strong className="font-medium text-amber-50">signed in</strong> as a{" "}
            <strong className="font-medium text-amber-50">verified leader</strong> (same account as this inbox).
          </li>
          <li>
            Use <strong className="font-medium text-amber-50">NEXT_PUBLIC_API_URL</strong> in{" "}
            <code className="rounded bg-black/30 px-1 text-[0.65rem]">web/.env.local</code> if the API is not on{" "}
            <code className="rounded bg-black/30 px-1 text-[0.65rem]">localhost:4000</code>.
          </li>
          {cloudReady ? (
            <li>
              <strong className="font-medium text-amber-50">Cloudinary</strong> is set — you can attach photo or video
              proof below (recommended for accountability). Wait for uploads to finish before broadcasting.
            </li>
          ) : (
            <li>
              Add <strong className="font-medium text-amber-50">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</strong> and{" "}
              <strong className="font-medium text-amber-50">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</strong> to{" "}
              <code className="rounded bg-black/30 px-1 text-[0.65rem]">web/.env.local</code>, then{" "}
              <strong className="font-medium text-amber-50">restart</strong> the Next dev server, if you want proof
              uploads. Without them you can still resolve with text only.
            </li>
          )}
        </ul>
      </div>

      <p className="mt-3 text-xs font-medium text-slate-400">Broadcast resolution to the public</p>
      <ol className="mt-2 space-y-1.5 text-xs text-slate-500">
        <li className={summaryOk ? "text-emerald-400/90" : ""}>
          <span className="font-medium text-slate-400">1.</span> Write the public update ({MIN_SUMMARY}+ characters)
          {summaryOk ? " — done" : ""}
        </li>
        <li className={!uploadBusy ? "text-emerald-400/90" : ""}>
          <span className="font-medium text-slate-400">2.</span>{" "}
          {cloudReady
            ? proof.length > 0
              ? `Proof: ${proof.length} file${proof.length === 1 ? "" : "s"} attached`
              : "Optionally upload photo / video proof (Browse)"
            : "Proof needs Cloudinary in .env.local (skip this step if you only have text)"}
          {!uploadBusy ? " — OK" : " — uploading…"}
        </li>
        <li className={canSubmit ? "text-emerald-400/90" : ""}>
          <span className="font-medium text-slate-400">3.</span> Click{" "}
          <strong className="text-slate-300">Mark resolved & broadcast</strong>
          {canSubmit ? " — ready" : ""}
        </li>
      </ol>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Explain what you did, timelines, and what residents should expect next…"
        className="mt-2 min-h-24 w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100"
        maxLength={4000}
        aria-label="Resolution summary"
      />
      <p className="mt-1 text-xs text-slate-600">
        {text.trim().length}/{MIN_SUMMARY} characters minimum for step 1
        {summaryOk ? " · OK" : ""}
      </p>

      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
        <p className="text-xs font-medium text-slate-400">Proof of work (optional, photo / video)</p>
        <p className="mt-0.5 text-xs text-slate-600">
          Upload up to {MAX_PROOF} files. If you add proof, wait until uploads finish before step 3 so everything is
          saved together.
        </p>
        {!cloudReady && (
          <p className="mt-2 text-xs text-amber-200/80">
            Configure Cloudinary in web/.env.local to enable proof uploads (same as citizen posts).
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            aria-label="Choose photo or video proof"
            accept={PROOF_ACCEPT}
            multiple
            disabled={uploadBusy || proof.length >= MAX_PROOF}
            onChange={(e) => void onPickProof(e)}
            className="block min-w-0 flex-1 text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:font-medium file:text-slate-100 hover:file:bg-slate-600 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={uploadBusy || proof.length >= MAX_PROOF}
            className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            onClick={() => inputRef.current?.click()}
          >
            Browse…
          </button>
        </div>
        {uploadBusy && <p className="mt-1 text-xs text-slate-500">Uploading proof…</p>}
        {proof.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            {proof.map((m, i) => (
              <li key={`${m.storageKey}-${i}`} className="flex items-center justify-between gap-2">
                <span className="truncate">
                  {m.kind} · {(m.sizeBytes / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => removeProof(i)}
                  className="shrink-0 text-rose-400 hover:text-rose-300"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
      <button
        type="button"
        disabled={busy}
        className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md transition sm:w-auto ${
          busy
            ? "cursor-wait bg-emerald-800 opacity-90"
            : canSubmit
              ? "cursor-pointer bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              : "cursor-pointer bg-slate-600 hover:bg-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-950"
        }`}
        onClick={tryResolve}
      >
        {busy ? "Saving…" : "Mark resolved & broadcast"}
      </button>
      {!busy && !canSubmit && (
        <p className="mt-1.5 text-xs text-slate-500">
          Button stays clickable: if something is missing, we show what to do above in red when you click.
        </p>
      )}
    </div>
  );
}
