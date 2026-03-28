import Link from "next/link";

export default function NotFound() {
  return (
    <div className="space-y-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-white">Page not found</h1>
      <p className="text-sm text-slate-500">That URL does not exist.</p>
      <Link href="/" className="text-emerald-400 hover:underline">
        Back to feed
      </Link>
    </div>
  );
}
