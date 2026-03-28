import type { NextConfig } from "next";

/**
 * Standalone output is for Docker (`web/Dockerfile`). Do **not** enable it for local
 * `next dev` — it correlates with broken webpack chunks (e.g. Cannot find module './624.js')
 * and missing `/_next/static/*` when `.next` gets out of sync.
 */
const useStandalone = process.env.NEXT_STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(useStandalone ? { output: "standalone" as const } : {}),
};

export default nextConfig;
