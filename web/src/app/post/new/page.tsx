"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  CLOUDINARY_ACCEPT,
  isCloudinaryConfigured,
  uploadFileToCloudinary,
  type UploadedMediaForPost,
} from "@/lib/cloudinaryUpload";
import type { FeedPost } from "@/components/PostCard";
import { api, ApiError, ensureAnonSession } from "@/lib/api";

type SimilarPostPayload = {
  duplicatePost: FeedPost;
  meta: {
    distanceKm: number;
    matchedBy: "tags" | "text";
    tagJaccard: number | null;
    sharedTags: string[];
  };
};

function similarPostFromApiPayload(payload: unknown): SimilarPostPayload | null {
  if (!payload || typeof payload !== "object") return null;
  const err = (payload as { error?: { code?: string; details?: unknown } }).error;
  if (err?.code !== "SIMILAR_POST_EXISTS" || !err.details || typeof err.details !== "object") return null;
  const d = err.details as SimilarPostPayload;
  if (!d.duplicatePost?.id) return null;
  return d;
}

const MAX_FILES = 20;
const MAX_BYTES = 40 * 1024 * 1024;
export default function NewPostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lng, setLng] = useState("77.209");
  const [lat, setLat] = useState("28.6139");
  const [leaders, setLeaders] = useState("");
  const [anon, setAnon] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [districtKey, setDistrictKey] = useState("");
  const [villageLabel, setVillageLabel] = useState("");
  const [issueTagsRaw, setIssueTagsRaw] = useState("");
  const [skipDuplicateMerge, setSkipDuplicateMerge] = useState(false);
  const [similarOffer, setSimilarOffer] = useState<SimilarPostPayload | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const [media, setMedia] = useState<UploadedMediaForPost[]>([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const cloudReady = isCloudinaryConfigured();

  const resetFileInput = useCallback(() => {
    const el = fileInputRef.current;
    if (el) el.value = "";
  }, []);

  async function processPickedFiles(files: File[]) {
    if (files.length === 0) return;
    if (!cloudReady) {
      setUploadErr(
        "Cloudinary is not configured. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET in web/.env.local, then restart npm run dev.",
      );
      resetFileInput();
      return;
    }
    setUploadErr(null);
    const room = MAX_FILES - media.length;
    if (room <= 0) {
      setUploadErr(`At most ${MAX_FILES} attachments.`);
      resetFileInput();
      return;
    }
    const take = files.slice(0, room);
    if (take.length < files.length) {
      setUploadErr(`Only ${room} more file(s) allowed; extra skipped.`);
    }
    setUploadBusy(true);
    try {
      for (const file of take) {
        if (file.size > MAX_BYTES) {
          throw new Error(
            `"${file.name}" is too large (max ${MAX_BYTES / 1024 / 1024} MB).`,
          );
        }
        setUploadStatus(`Uploading “${file.name}”…`);
        const item = await uploadFileToCloudinary(file);
        setMedia((m) => [...m, item]);
      }
    } catch (er) {
      setUploadErr((er as Error).message);
    } finally {
      setUploadStatus(null);
      setUploadBusy(false);
      resetFileInput();
    }
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = input.files?.length ? Array.from(input.files) : [];
    input.value = "";
    if (!files.length) return;
    void processPickedFiles(files);
  }

  function onDropMedia(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!cloudReady || uploadBusy || media.length >= MAX_FILES) return;
    const dt = e.dataTransfer.files;
    if (!dt?.length) return;
    void processPickedFiles(Array.from(dt));
  }

  function removeMedia(i: number) {
    setMedia((m) => m.filter((_, idx) => idx !== i));
  }

  function fillCoordsFromGps() {
    if (!navigator.geolocation) {
      setMsg("Geolocation not available.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLng(String(Number(pos.coords.longitude.toFixed(5))));
        setLat(String(Number(pos.coords.latitude.toFixed(5))));
        setMsg(null);
      },
      () => setMsg("Could not read GPS coordinates."),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }

  async function publishPost(e: React.FormEvent | null, options?: { forceNew?: boolean }) {
    e?.preventDefault();
    setMsg(null);
    ensureAnonSession();
    const taggedLeaders = leaders
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/^@+/, ""))
      .filter(Boolean);
    if (taggedLeaders.length === 0) {
      setMsg("Tag at least one leader by their public user id (e.g. mayor-singh).");
      return;
    }
    const issueTags = issueTagsRaw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const skipMerge = skipDuplicateMerge || Boolean(options?.forceNew);
    type CreateRes = { post: { id: string }; anonymousSessionId?: string };
    try {
      const res = await api<CreateRes>("/posts", {
        method: "POST",
        json: {
          title,
          body,
          location: { coordinates: [Number(lng), Number(lat)] },
          taggedLeaders,
          isAnonymous: anon,
          skipDuplicateMerge: skipMerge,
          ...(districtKey.trim() ? { districtKey: districtKey.trim() } : {}),
          ...(villageLabel.trim() ? { villageLabel: villageLabel.trim() } : {}),
          ...(issueTags.length > 0 ? { issueTags } : {}),
          ...(media.length > 0 ? { media } : {}),
        },
      });
      setSimilarOffer(null);
      if (res.anonymousSessionId) {
        localStorage.setItem("anonSession", res.anonymousSessionId);
      }
      router.push("/");
    } catch (er) {
      if (er instanceof ApiError) {
        const sp = similarPostFromApiPayload(er.payload);
        if (sp) {
          setSimilarOffer(sp);
          setMsg(null);
          return;
        }
      }
      setMsg((er as Error).message);
    }
  }

  async function upvoteExistingAndLeave() {
    if (!similarOffer) return;
    setVoteBusy(true);
    setMsg(null);
    ensureAnonSession();
    try {
      type VoteRes = {
        upvoteCount: number;
        downvoteCount: number;
        voteScore: number;
        yourVote: number;
      };
      const voteRes = await api<VoteRes>(`/posts/${similarOffer.duplicatePost.id}/vote`, {
        method: "POST",
        json: { value: 1 },
      });
      const pct =
        similarOffer.meta.tagJaccard != null
          ? `${Math.round(similarOffer.meta.tagJaccard * 100)}% tag overlap`
          : "similar wording";
      try {
        sessionStorage.setItem(
          "civic_feed_notice",
          `Upvote saved. This thread now has ${voteRes.upvoteCount} upvotes (${pct}, ~${similarOffer.meta.distanceKm} km away). Higher counts help leaders notice it.`,
        );
      } catch {
        /* ignore */
      }
      setSimilarOffer(null);
      router.push("/");
    } catch (er) {
      setMsg((er as Error).message);
    } finally {
      setVoteBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Create post</h1>
      <p className="text-sm text-slate-500">
        Posts are scanned by OpenAI moderation when configured on the API. Risky posts stay pending.
      </p>

      {similarOffer && (
        <div
          className="rounded-2xl border-2 border-amber-600/60 bg-amber-950/25 p-5 shadow-lg shadow-amber-900/20"
          role="region"
          aria-label="Similar existing concern"
        >
          <p className="text-base font-semibold text-amber-100">
            This issue may already be on the map — add strength with your upvote
          </p>
          <p className="mt-2 text-sm text-amber-100/80">
            We found an open post within about <strong className="text-amber-50">1 km</strong>
            {similarOffer.meta.matchedBy === "tags" && similarOffer.meta.tagJaccard != null ? (
              <>
                {" "}
                with <strong className="text-amber-50">≥50% matching issue tags</strong> (about{" "}
                {Math.round(similarOffer.meta.tagJaccard * 100)}% Jaccard overlap
                {similarOffer.meta.sharedTags.length > 0
                  ? ` on: ${similarOffer.meta.sharedTags.join(", ")}`
                  : ""}
                ).
              </>
            ) : (
              <> with very similar wording in the title or description.</>
            )}{" "}
            One thread with more upvotes ranks higher so leaders see it faster.
          </p>
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/80 p-4">
            <p className="text-sm font-medium text-white">{similarOffer.duplicatePost.title}</p>
            <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs text-slate-400">
              {similarOffer.duplicatePost.body}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Score {similarOffer.duplicatePost.voteScore ?? 0} · ~{similarOffer.meta.distanceKm} km away
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={voteBusy}
              onClick={() => void upvoteExistingAndLeave()}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {voteBusy ? "Recording upvote…" : "Upvote this concern & go to feed"}
            </button>
            <button
              type="button"
              disabled={voteBusy}
              onClick={() => void publishPost(null, { forceNew: true })}
              className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50"
            >
              Mine is different — publish as new post anyway
            </button>
            <button
              type="button"
              disabled={voteBusy}
              onClick={() => setSimilarOffer(null)}
              className="rounded-xl px-4 py-3 text-sm text-slate-400 hover:text-slate-200"
            >
              Edit my draft
            </button>
          </div>
        </div>
      )}

      <form onSubmit={publishPost} className="space-y-4">
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="min-h-32 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Describe the issue"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div
            className={`rounded-lg border-2 border-dashed p-4 transition-colors ${
              !uploadBusy && media.length < MAX_FILES
                ? "border-slate-600 bg-slate-950/30 hover:border-emerald-700/40"
                : "border-slate-800 bg-slate-950/20 opacity-70"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={onDropMedia}
          >
            <p className="mb-3 text-sm font-medium text-slate-300">Photos, video, audio, PDF, documents</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={CLOUDINARY_ACCEPT}
                disabled={uploadBusy || media.length >= MAX_FILES}
                onChange={onPickFiles}
                className="min-w-0 flex-1 text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-600 disabled:opacity-50"
              />
              <button
                type="button"
                disabled={uploadBusy || media.length >= MAX_FILES}
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-600 bg-slate-900 px-4 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose files…
              </button>
              <span className="text-xs text-slate-500 sm:pb-2">or drag into this box</span>
            </div>
          </div>
          {!cloudReady && (
            <p className="mt-2 text-xs text-amber-200/90">
              Set <code className="text-amber-100">NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME</code> and{" "}
              <code className="text-amber-100">NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET</code> in{" "}
              <code className="text-amber-100">web/.env.local</code>, then restart <code className="text-amber-100">npm run dev</code>.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            Up to {MAX_FILES} files, {MAX_BYTES / 1024 / 1024} MB each. PDF/docs use Cloudinary &quot;raw&quot;. If uploads
            fail, ensure your unsigned preset allows image + video + raw, and only set{" "}
            <code className="text-slate-500">NEXT_PUBLIC_CLOUDINARY_FOLDER</code> when the preset allows that folder.
          </p>
          {(uploadBusy || uploadStatus) && (
            <p className="mt-2 text-sm text-slate-400">{uploadStatus ?? "Uploading…"}</p>
          )}
          {uploadErr && <p className="mt-2 text-sm text-rose-400">{uploadErr}</p>}
          {media.length > 0 && (
            <ul className="mt-3 space-y-2">
              {media.map((m, i) => (
                <li
                  key={`${m.storageKey}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400"
                >
                  <span className="truncate">
                    <span className="text-slate-300">{m.kind}</span> · {m.mimeType} · {(m.sizeBytes / 1024).toFixed(1)}{" "}
                    KB
                  </span>
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="shrink-0 text-rose-400 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4">
          <p className="text-sm font-medium text-slate-300">Where & what (helps ranking & duplicate merge)</p>
          <p className="mt-1 text-xs text-slate-500">
            Add issue tags and accurate coordinates: if an open post exists within ~1 km with strongly matching tags
            (≥50% overlap), we will ask you to upvote that thread first so one concern stays visible and strong for
            leaders.
          </p>
          <input
            className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
            placeholder="District / block key (e.g. north-west-delhi)"
            value={districtKey}
            onChange={(e) => setDistrictKey(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
            placeholder="Village or locality (optional, shown on the card)"
            value={villageLabel}
            onChange={(e) => setVillageLabel(e.target.value)}
          />
          <input
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
            placeholder="Issue tags: roads, water, garbage, streetlight …"
            value={issueTagsRaw}
            onChange={(e) => setIssueTagsRaw(e.target.value)}
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-400">
            <input
              type="checkbox"
              checked={skipDuplicateMerge}
              onChange={(e) => setSkipDuplicateMerge(e.target.checked)}
            />
            Always create a new post (skip similar-match merge)
          </label>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fillCoordsFromGps()}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600"
            >
              Use GPS for map coordinates
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="Longitude"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
            />
            <input
              className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              placeholder="Latitude"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
            />
          </div>
        </div>
        <input
          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
          placeholder="Leader public user ids: mayor-singh, @block-officer-ria (comma or space)"
          value={leaders}
          onChange={(e) => setLeaders(e.target.value)}
        />
        <p className="text-xs text-slate-500">
          Use each leader&apos;s unique public user id from signup — the server maps it to their office profile. Legacy
          24-character profile ids still work if you paste them.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-400">
          <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
          Post anonymously (still needs login or X-Anonymous-Session)
        </label>
        {msg && <p className="text-sm text-rose-400">{msg}</p>}
        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500"
        >
          Publish
        </button>
      </form>
    </div>
  );
}
