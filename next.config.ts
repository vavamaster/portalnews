import type { NextConfig } from "next";

// Deploy target detection:
// - Default (no env var) → output: "standalone" (works on space-z.ai, VPS, Docker)
// - DEPLOY_TARGET=serverless → no standalone output (for Vercel/Netlify/Cloudflare)
const isServerless = process.env.DEPLOY_TARGET === 'serverless'

const nextConfig: NextConfig = {
  ...(isServerless ? {} : { output: "standalone" }),
  reactStrictMode: false,
  // === Server externals ===
  // Baileys dynamically imports jimp + sharp for media processing (with .catch fallback).
  // Turbopack tries to resolve them at build time — mark as external so the import
  // is left as a runtime require (gracefully fails if not installed, Baileys catches it).
  serverExternalPackages: ['jimp', 'sharp', '@whiskeysockets/baileys'],
  async headers() {
    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), usb=()' },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "frame-ancestors 'self'",
          "form-action 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
          "style-src 'self' 'unsafe-inline' https:",
          "img-src 'self' data: blob: http: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' http: https: ws: wss:",
          "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.google.com",
          "media-src 'self' blob: http: https:",
          "worker-src 'self' blob:",
        ].join('; '),
      },
    ]
    if (process.env.NODE_ENV === 'production') {
      securityHeaders.push({ key: 'Strict-Transport-Security', value: 'max-age=15552000' })
    }
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
  async redirects() {
    return [
      { source: '/article/:slug', destination: '/noticias/:slug', permanent: true },
    ]
  },
  async rewrites() {
    return [
      { source: '/noticias/:slug', destination: '/?article=:slug' },
      { source: '/categoria/:slug', destination: '/?category=:slug' },
      { source: '/buscar', has: [{ type: 'query', key: 'q', value: '(?<query>.+)' }], destination: '/?search=:query' },
      { source: '/buscar', destination: '/?search=' },
      { source: '/tag/:tag', destination: '/?tag=:tag' },
      { source: '/entrar', destination: '/?view=login' },
      { source: '/cadastro', destination: '/?view=register' },
      { source: '/minha-conta', destination: '/?view=profile' },
      { source: '/meus-creditos', destination: '/?view=credits' },
      { source: '/anuncie', destination: '/?view=store' },
      { source: '/sobre', destination: '/?view=about' },
      { source: '/contato', destination: '/?view=contact' },
      { source: '/classificados/anuncio/:slug', destination: '/?classified=:slug' },
      { source: '/classificados/categoria/:slug', destination: '/?ccat=:slug' },
      { source: '/classificados/editar/:id', destination: '/?view=classified-editor&id=:id' },
      { source: '/classificados/anunciar', destination: '/?view=classified-editor' },
      { source: '/classificados', destination: '/?view=classifieds' },
      { source: '/planos', destination: '/?view=plans' },
      { source: '/painel-anunciante', destination: '/?view=advertiser' },
      { source: '/editores/meu-perfil/editar', destination: '/?view=editor-bio-edit' },
      { source: '/editores/:slug', destination: '/?editor=:slug' },
      { source: '/editores', destination: '/?view=editors' },
      { source: '/cotacoes', destination: '/?view=quotes' },
      { source: '/empresa/painel', destination: '/?view=enterprise' },
      { source: '/empresa/:slug', destination: '/?empresa=:slug' },
    ]
  },
};

export default nextConfig;
