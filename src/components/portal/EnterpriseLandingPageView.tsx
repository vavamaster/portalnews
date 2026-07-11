'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { SmartImage } from '@/components/ui/smart-image'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  MapPin, Phone, Mail, Globe, Facebook, Instagram, Youtube, Linkedin,
  ChevronRight, Play, ExternalLink, Building2,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'

interface Props {
  slug: string
}

export function EnterpriseLandingPageView({ slug }: Props) {
  const { setView } = useAppStore()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/landing-page/${encodeURIComponent(slug)}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null }
        return r.json()
      })
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [slug])

  // Update document title with the company name + SEO title
  useEffect(() => {
    if (data?.companyName) {
      document.title = data.seoTitle || `${data.companyName} | ${data.categoryName || 'Patrocinador'}`
    }
  }, [data])

  if (loading) {
    return (
      <div className="news-container py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-zinc-200 rounded" />
          <div className="h-8 bg-zinc-200 rounded w-1/2" />
          <div className="h-4 bg-zinc-200 rounded w-3/4" />
        </div>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="news-container py-12 text-center">
        <Building2 className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Empresa não encontrada</h1>
        <p className="text-zinc-600 mb-6">A página que você procura não existe ou foi desativada.</p>
        <Button onClick={() => setView({ name: 'home' })} className="bg-primary">Voltar ao início</Button>
      </div>
    )
  }

  // Build Google Maps directions URL (auto-route from user's location to the company)
  const directionsUrl = data.latitude && data.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`
    : data.address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${data.address}, ${data.city || ''}, ${data.state || ''}`)}`
      : null

  // Parse JSON fields
  const products = data.products || []
  const services = data.services || []
  const gallery = data.gallery || []
  const videoUrls = data.videoUrls || []

  // Extract YouTube video IDs
  const getYtId = (url: string) => {
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/)
    return m ? m[1] : null
  }

  const primary = data.primaryColor || '#2563eb'

  return (
    <div className="animate-fade-in">
      {/* === HERO === */}
      <section
        className="relative"
        style={{ backgroundColor: primary }}
      >
        {data.heroImageUrl && (
          <div className="absolute inset-0">
            <SmartImage src={data.heroImageUrl} alt={data.companyName} containerClassName="absolute inset-0" className="w-full h-full object-cover" loading="eager" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${primary}cc 0%, ${primary}80 100%)` }} />
          </div>
        )}
        <div className="news-container relative py-12 sm:py-20 text-white">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              {data.logoUrl && (
                <img src={data.logoUrl} alt={data.companyName} className="h-14 w-14 rounded-lg bg-white/10 backdrop-blur" />
              )}
              <div>
                {data.niche && (
                  <div className="text-xs uppercase tracking-wider opacity-80 mb-0.5">{data.niche}</div>
                )}
                <h1 className="text-2xl sm:text-4xl font-black">{data.companyName}</h1>
              </div>
            </div>
            {data.heroTitle && (
              <h2 className="text-xl sm:text-3xl mb-2" style={{ fontWeight: 600 }}>{data.heroTitle}</h2>
            )}
            {data.heroSubtitle && (
              <p className="text-base sm:text-lg opacity-90 max-w-2xl">{data.heroSubtitle}</p>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {data.phone && (
                <a href={`tel:${data.phone}`} className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-2 rounded-lg text-sm hover:bg-white/30 transition-colors">
                  <Phone className="h-4 w-4" /> {data.phone}
                </a>
              )}
              {data.whatsapp && (
                <a href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-emerald-500 px-3 py-2 rounded-lg text-sm hover:bg-emerald-600 transition-colors">
                  WhatsApp <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {data.website && (
                <a href={data.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-3 py-2 rounded-lg text-sm hover:bg-white/30 transition-colors">
                  <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* === ABOUT === */}
      {data.aboutText && (
        <section className="news-container py-8">
          <div className="prose-news max-w-3xl">
            <ReactMarkdown>{data.aboutText}</ReactMarkdown>
          </div>
        </section>
      )}

      {/* === PRODUCTS & SERVICES === */}
      {(products.length > 0 || services.length > 0) && (
        <section className="news-container py-8 border-t border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Produtos & Serviços</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((p: any, i: number) => (
              <div key={`p-${i}`} className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                {p.imageUrl && <img src={p.imageUrl} alt={p.name} className="w-full h-40 object-cover" />}
                <div className="p-3">
                  <div className="font-bold text-zinc-900">{p.name}</div>
                  {p.description && <p className="text-sm text-zinc-600 mt-1">{p.description}</p>}
                  {p.price && <div className="text-primary font-bold mt-2">{p.price}</div>}
                </div>
              </div>
            ))}
            {services.map((s: any, i: number) => (
              <div key={`s-${i}`} className="bg-white border border-zinc-200 rounded-lg p-4">
                <div className="font-bold text-zinc-900">{s.name}</div>
                {s.description && <p className="text-sm text-zinc-600 mt-1">{s.description}</p>}
                {s.price && <div className="text-primary font-bold mt-2">{s.price}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === GALLERY === */}
      {gallery.length > 0 && (
        <section className="news-container py-8 border-t border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Galeria</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {gallery.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-zinc-100">
                <SmartImage src={url} alt={`Imagem ${i + 1}`} containerClassName="w-full h-full" className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* === VIDEOS === */}
      {videoUrls.length > 0 && (
        <section className="news-container py-8 border-t border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4">Vídeos</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {videoUrls.map((url: string, i: number) => {
              const ytId = getYtId(url)
              return ytId ? (
                <div key={i} className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={`https://www.youtube.com/embed/${ytId}`}
                    title={`Vídeo ${i + 1}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : null
            }).filter(Boolean)}
          </div>
        </section>
      )}

      {/* === LOCATION === */}
      {(data.address || (data.latitude && data.longitude)) && (
        <section className="news-container py-8 border-t border-zinc-100">
          <h2 className="text-2xl font-bold text-zinc-900 mb-4 flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" /> Localização
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-2">
              {data.address && <div className="text-sm text-zinc-700">{data.address}</div>}
              {(data.city || data.state) && (
                <div className="text-sm text-zinc-700">{data.city}{data.city && data.state ? ' — ' : ''}{data.state} {data.zipCode}</div>
              )}
              {directionsUrl && (
                <a href={directionsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 bg-primary text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700">
                  <MapPin className="h-4 w-4" /> Traçar rota até aqui <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {data.latitude && data.longitude && (
              <div className="aspect-video rounded-lg overflow-hidden border border-zinc-200">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${data.longitude - 0.01}%2C${data.latitude - 0.01}%2C${data.longitude + 0.01}%2C${data.latitude + 0.01}&layer=mapnik&marker=${data.latitude}%2C${data.longitude}`}
                  className="w-full h-full"
                  title="Mapa"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* === CONTACT === */}
      <section className="news-container py-8 border-t border-zinc-100">
        <h2 className="text-2xl font-bold text-zinc-900 mb-4">Contato</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.phone && (
            <a href={`tel:${data.phone}`} className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-primary transition-colors">
              <Phone className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-zinc-500">Telefone</div>
                <div className="font-medium text-sm text-zinc-900">{data.phone}</div>
              </div>
            </a>
          )}
          {data.whatsapp && (
            <a href={`https://wa.me/${data.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-emerald-500 transition-colors">
              <div className="h-5 w-5 text-emerald-600 flex items-center justify-center font-bold">W</div>
              <div>
                <div className="text-xs text-zinc-500">WhatsApp</div>
                <div className="font-medium text-sm text-zinc-900">{data.whatsapp}</div>
              </div>
            </a>
          )}
          {data.email && (
            <a href={`mailto:${data.email}`} className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-primary transition-colors">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-zinc-500">Email</div>
                <div className="font-medium text-sm text-zinc-900 break-all">{data.email}</div>
              </div>
            </a>
          )}
          {data.website && (
            <a href={data.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-primary transition-colors">
              <Globe className="h-5 w-5 text-primary" />
              <div>
                <div className="text-xs text-zinc-500">Website</div>
                <div className="font-medium text-sm text-zinc-900 break-all">{data.website.replace(/^https?:\/\//, '')}</div>
              </div>
            </a>
          )}
          {data.facebookUrl && (
            <a href={data.facebookUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-blue-500 transition-colors">
              <Facebook className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-xs text-zinc-500">Facebook</div>
                <div className="font-medium text-sm text-zinc-900">@{data.facebookUrl.replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\//g, '')}</div>
              </div>
            </a>
          )}
          {data.instagramUrl && (
            <a href={data.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 bg-white border border-zinc-200 rounded-lg p-3 hover:border-pink-500 transition-colors">
              <Instagram className="h-5 w-5 text-pink-600" />
              <div>
                <div className="text-xs text-zinc-500">Instagram</div>
                <div className="font-medium text-sm text-zinc-900">@{data.instagramUrl.replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\//g, '')}</div>
              </div>
            </a>
          )}
        </div>
      </section>

      {/* === Footer === */}
      <div className="news-container py-6 text-center text-xs text-zinc-400 border-t border-zinc-100">
        Patrocinador oficial de <strong className="text-zinc-600">{data.categoryName}</strong>
        <button onClick={() => setView({ name: 'home' })} className="ml-2 text-primary hover:underline">Voltar ao portal</button>
      </div>
    </div>
  )
}
