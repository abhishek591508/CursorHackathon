"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function LeaderPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<{
    leader: {
      publicName: string;
      slug: string;
      accountabilityCompositeScore?: number | null;
      citizenSupportCreditTotal?: number | null;
      concernsResolvedCount?: number | null;
      resolutionsWithProofCount?: number | null;
    };
    latest?: { dimensions?: { key: string; label: string; value: number }[] };
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:4000";
    fetch(`${base}/api/leaders/${id}/accountability`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.leader) setErr("Not found");
        else setData(j);
      })
      .catch(() => setErr("Failed to load"));
  }, [id]);

  if (err || !data?.leader) {
    return (
      <p className="text-slate-500">
        {err ?? "Loading…"}{" "}
        <Link href="/" className="text-emerald-400">
          Home
        </Link>
      </p>
    );
  }

  const l = data.leader;
  const snap = data.latest;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
        <h1 className="text-2xl font-bold text-white">{l.publicName}</h1>
        <p className="text-slate-500">@{l.slug}</p>
        {l.accountabilityCompositeScore != null && (
          <p className="mt-4 text-3xl font-semibold text-emerald-400">
            {Number(l.accountabilityCompositeScore).toFixed(1)}
            <span className="ml-2 text-sm font-normal text-slate-500">
              accountability score
            </span>
          </p>
        )}
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
          <p className="font-medium text-slate-300">Citizen support & resolutions</p>
          <ul className="mt-2 space-y-1">
            <li>
              Support credit from resolved concerns:{" "}
              <span className="text-cyan-400">{l.citizenSupportCreditTotal ?? 0}</span>{" "}
              <span className="text-slate-600">(sum of upvotes on posts you closed)</span>
            </li>
            <li>
              Concerns marked resolved:{" "}
              <span className="text-slate-200">{l.concernsResolvedCount ?? 0}</span>
            </li>
            <li>
              With photo/video proof:{" "}
              <span className="text-slate-200">{l.resolutionsWithProofCount ?? 0}</span>
            </li>
          </ul>
        </div>
        {snap?.dimensions && (
          <ul className="mt-4 space-y-1 text-sm text-slate-400">
            {snap.dimensions.map((d) => (
              <li key={d.key}>
                {d.label}: <span className="text-slate-200">{d.value}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
