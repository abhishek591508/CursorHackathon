"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, getStoredUser, getToken, type PublicUser } from "@/lib/api";

type AppRow = {
  id: string;
  applicantUserId: string;
  status: string;
  slug: string;
  publicName: string;
  createdAt?: string;
  rejectionReason?: string | null;
};

export default function AdminLeadersPage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all" | "approved" | "rejected">("pending");
  const [rows, setRows] = useState<AppRow[]>([]);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createUserId, setCreateUserId] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createName, setCreateName] = useState("");
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const q =
        statusFilter === "all" ? "status=all" : `status=${statusFilter}`;
      const r = await api<{ applications: AppRow[]; total: number }>(
        `/admin/leader-applications?${q}&limit=50&skip=0`,
      );
      setRows(r.applications);
      setTotal(r.total);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    const u = getStoredUser();
    setUser(u);
    if (u?.role !== "admin" && u?.role !== "super_admin") {
      setAllowed(false);
      return;
    }
    setAllowed(true);
  }, [router]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function approve(id: string) {
    setBusyId(id);
    setErr(null);
    try {
      await api(`/admin/leader-applications/${id}/approve`, {
        method: "POST",
        json: {},
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: string) {
    const reason = window.prompt("Rejection reason (required):")?.trim();
    if (!reason) return;
    setBusyId(id);
    setErr(null);
    try {
      await api(`/admin/leader-applications/${id}/reject`, {
        method: "POST",
        json: { reason },
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    setErr(null);
    try {
      const res = await api<{ leaderProfile: { id: string }; message?: string }>(
        "/admin/leader-profiles",
        {
          method: "POST",
          json: {
            userId: createUserId.trim(),
            slug: createSlug.trim().toLowerCase(),
            publicName: createName.trim(),
          },
        },
      );
      setCreateMsg(`Created leader profile ${res.leaderProfile.id}. User must re-login.`);
      setCreateUserId("");
      setCreateSlug("");
      setCreateName("");
    } catch (e) {
      setCreateMsg((e as Error).message);
    }
  }

  if (!getToken()) return null;

  if (allowed === false) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-bold text-white">Access denied</h1>
        <p className="text-slate-500">You need role admin or super_admin.</p>
        <Link href="/" className="text-emerald-400 hover:underline">
          Home
        </Link>
      </div>
    );
  }

  if (allowed === null) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin · Leaders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review applications or create a leader profile for a <strong className="text-slate-400">user</strong> account
          (Mongo ObjectIds).
        </p>
        {user && (
          <p className="mt-1 text-xs text-slate-600">
            Signed in as {user.email} · {user.role}
          </p>
        )}
      </div>

      {err && (
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
          {err}
        </div>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h2 className="text-lg font-semibold text-emerald-400">Create leader profile (direct)</h2>
        <p className="mt-1 text-sm text-slate-500">
          Target account must have role <code className="text-slate-400">user</code> and no existing leader profile.
        </p>
        <form onSubmit={createProfile} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-sm text-slate-200"
            placeholder="User Mongo _id (24 hex)"
            value={createUserId}
            onChange={(e) => setCreateUserId(e.target.value)}
            required
          />
          <input
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            placeholder="Slug (e.g. mayor-smith)"
            value={createSlug}
            onChange={(e) => setCreateSlug(e.target.value)}
            required
          />
          <input
            className="sm:col-span-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
            placeholder="Public name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="sm:col-span-2 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create profile &amp; promote to leader
          </button>
        </form>
        {createMsg && (
          <p
            className={`mt-3 text-sm ${createMsg.includes("Created") ? "text-emerald-400" : "text-rose-400"}`}
          >
            {createMsg}
          </p>
        )}
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Applications</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200"
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
          <span className="text-sm text-slate-500">{total} total</span>
          <button
            type="button"
            onClick={() => void load()}
            className="text-sm text-emerald-400 hover:underline"
          >
            Refresh
          </button>
        </div>

        <ul className="space-y-3">
          {rows.length === 0 ? (
            <li className="text-slate-600">No applications.</li>
          ) : (
            rows.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-200">
                    {a.publicName}{" "}
                    <span className="text-slate-500">({a.status})</span>
                  </p>
                  <p className="font-mono text-xs text-slate-500">
                    slug: {a.slug} · applicant user: {a.applicantUserId}
                  </p>
                  {a.rejectionReason && (
                    <p className="mt-1 text-xs text-rose-400/90">Rejected: {a.rejectionReason}</p>
                  )}
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => void approve(a.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyId === a.id}
                      onClick={() => void reject(a.id)}
                      className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
