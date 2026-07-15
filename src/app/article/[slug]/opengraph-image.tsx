import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { getSeoSettings } from '@/lib/seo'
import { getSiteName } from '@/lib/seo-helpers'
import { normalizeThemeColor, THEME_COLOR_DEFAULTS } from '@/lib/theme-config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Article preview'

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // Fetch post + site settings
  const [post, settings] = await Promise.all([
    db.post.findFirst({
      where: { slug, status: 'PUBLISHED' },
      select: {
        title: true,
        subtitle: true,
        category: { select: { name: true } },
        author: { select: { name: true } },
        coverImage: true,
      },
    }),
    getSeoSettings(),
  ])

  const siteName = getSiteName(settings)
  const primaryColor = normalizeThemeColor(settings.primary_color, THEME_COLOR_DEFAULTS.primary_color)
  const tagline = settings.site_tagline || 'Portal de Notícias'

  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: `linear-gradient(135deg, ${primaryColor} 0%, #1e293b 100%)`,
            color: 'white',
            padding: '60px',
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 800 }}>{siteName}</div>
          <div style={{ fontSize: 20, opacity: 0.8, marginTop: 8 }}>{tagline}</div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 700 }}>Artigo não encontrado</div>
          </div>
        </div>
      ),
      { ...size }
    )
  }

  // Format category + author for the badge
  const badge = [post.category?.name, post.author?.name].filter(Boolean).join(' · ')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: '#0f172a',
          color: 'white',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Background gradient */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${primaryColor}E6 0%, #0f172a 60%)`,
          }}
        />

        {/* Cover image (if exists) — top half */}
        {post.coverImage && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '50%',
              backgroundImage: `url(${post.coverImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              maskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0))',
              WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 50%, rgba(0,0,0,0))',
            }}
          />
        )}

        {/* Top bar: site name + tagline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '40px 60px',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                fontWeight: 900,
                color: primaryColor,
              }}
            >
              {siteName.slice(0, 2).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 26, fontWeight: 800 }}>{siteName}</div>
              <div style={{ fontSize: 14, opacity: 0.8 }}>{tagline}</div>
            </div>
          </div>
          {badge && (
            <div
              style={{
                fontSize: 14,
                padding: '8px 16px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              {badge}
            </div>
          )}
        </div>

        {/* Title (bottom half) */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            padding: '0 60px 60px',
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: 16,
              textShadow: '0 2px 20px rgba(0,0,0,0.5)',
            }}
          >
            {post.title}
          </div>
          {post.subtitle && (
            <div
              style={{
                fontSize: 22,
                opacity: 0.85,
                lineHeight: 1.4,
                marginBottom: 24,
                textShadow: '0 1px 10px rgba(0,0,0,0.5)',
              }}
            >
              {post.subtitle}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
