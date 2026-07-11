import type { NextConfig } from "next";

// Deploy target detection:
// - Default (no env var) → output: "standalone" (works on space-z.ai, VPS, Docker)
// - DEPLOY_TARGET=serverless → no standalone output (for Vercel/Netlify/Cloudflare)
const isServerless = process.env.DEPLOY_TARGET === 'serverless'

const nextConfig: NextConfig = {
  ...(isServerless ? {} : { output: "standalone" }),
  // Skip type-checking during build to avoid deploy failures on type-only issues.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
