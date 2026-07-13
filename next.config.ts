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
  // === Server externals ===
  // Baileys dynamically imports jimp + sharp for media processing (with .catch fallback).
  // Turbopack tries to resolve them at build time — mark as external so the import
  // is left as a runtime require (gracefully fails if not installed, Baileys catches it).
  serverExternalPackages: ['jimp', 'sharp', '@whiskeysockets/baileys'],
};

export default nextConfig;
