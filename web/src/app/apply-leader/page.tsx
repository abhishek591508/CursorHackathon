"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, getStoredUser, getToken, type PublicUser } from "@/lib/api";

type Application = {
  id: string;
  status: string;
  slug: string;
  publicName: string;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  createdAt?: string;
} | null;

export default function ApplyLeaderPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [application, setApplication] = useState<Application | undefined>(undefined);
  const [slug, setSlug] = useState("");
  const [publicName, setPublicName] = useState("");
  const [bio, setBio] = useState("");
  const [officeTitle, setOfficeTitle] = useState("");
  const [jurisdictionLabel, setJurisdictionLabel] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getStoredUser();
    setUser(u);
    if (u?.role !== "user" || u?.leaderProfileId) {
      return;
    }
    api<{ application: Application }>("/leaders/application/me")
      .then((r) => setApplication(r.application))
      .catch(() => setApplication(null));
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);
    try {
      await api("/leaders/apply", {
        method: "POST",
        json: {
          slug: slug.trim().toLowerCase(),
          publicName: publicName.trim(),
          bio: bio.trim() || undefined,
          officeTitle: officeTitle.trim() || null,
          jurisdictionLabel: jurisdictionLabel.trim() || null,
        },
      });
      const r = await api<{ application: Application }>("/leaders/application/me");
      setApplication(r.application);
      setInfo("Submitted. An admin will review your request.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (!getToken()) {
    return null;
  }

  if (user && user.role !== "user") {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">Leader profile</h1>
        <p className="text-slate-400">
          This flow is for accounts with role <strong className="text-slate-200">user</strong>. Admins create leader
          profiles from the admin console.
        </p>
        <Link href="/admin/leaders" className="text-emerald-400 hover:underline">
          Admin · Leaders
        </Link>
      </div>
    );
  }

  if (user?.leaderProfileId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-white">You are already a leader</h1>
        <p className="text-slate-400">
          Profile id: <code className="text-slate-300">{user.leaderProfileId}</code>
        </p>
        <Link href={`/leaders/${user.leaderProfileId}`} className="text-emerald-400 hover:underline">
          View public page
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Become a leader</h1>
        <p className="mt-1 text-sm text-slate-500">
          Submit a public leader profile for review. An <strong className="text-slate-400">admin</strong> or{" "}
          <strong className="text-slate-400">super admin</strong> must approve it before you can be tagged on posts.
        </p>
      </div>

      {application && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            application.status === "pending"
              ? "border-amber-800/60 bg-amber-950/30 text-amber-100"
              : application.status === "approved"
                ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-100"
                : "border-slate-700 bg-slate-900/60 text-slate-300"
          }`}
        >
          <p className="font-medium">Current application: {application.status}</p>
          <p className="mt-1 text-slate-400">
            Slug <code className="text-slate-300">{application.slug}</code> · {application.publicName}
          </p>
          {application.status === "rejected" && application.rejectionReason && (
            <p className="mt-2 text-rose-300/90">Reason: {application.rejectionReason}</p>
          )}
          {application.status === "approved" && (
            <p className="mt-2">Sign out and sign in again so your token includes the leader role.</p>
          )}
        </div>
      )}

      {application?.status === "pending" ? (
        <p className="text-sm text-slate-500">You cannot submit another application while one is pending.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-slate-500">URL slug (lowercase, hyphens)</label>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
              placeholder="e.g. priya-sharma-councilor"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Public name</label>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
              placeholder="Name as shown to citizens"
              value={publicName}
              onChange={(e) => setPublicName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Bio (optional)</label>
            <textarea
              className="min-h-24 w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Office title (optional)</label>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
              value={officeTitle}
              onChange={(e) => setOfficeTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">Jurisdiction (optional)</label>
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-slate-100"
              placeholder="e.g. Ward 12, North District"
              value={jurisdictionLabel}
              onChange={(e) => setJurisdictionLabel(e.target.value)}
            />
          </div>
          {err && <p className="text-sm text-rose-400">{err}</p>}
          {info && <p className="text-sm text-emerald-400">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      )}

      <p className="text-center text-sm text-slate-600">
        <Link href="/dashboard" className="text-emerald-500 hover:underline">
          Dashboard
        </Link>
      </p>
    </div>
  );
}
