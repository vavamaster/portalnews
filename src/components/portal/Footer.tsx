'use client'

import { useAppStore, type View } from '@/lib/store'
import { Mail, Phone, MapPin, Flame } from 'lucide-react'

interface FooterProps {
  categories: any[]
  socialLinks: {
    facebook?: string
    instagram?: string
    twitter?: string
    youtube?: string
    whatsapp?: string
  }
  siteName?: string
  seoSettings?: Record<string, string>
}

export function Footer({ categories, socialLinks, siteName = 'Portal de Notícias', seoSettings = {} }: FooterProps) {
  const { setView } = useAppStore()
  const handleNav = (v: View) => {
    setView(v)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Dynamic brand values from SEO settings
  const siteInitials = siteName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
  const siteLogo = seoSettings.site_logo || ''
  const siteLogoDark = seoSettings.site_logo_dark || ''
  const footerLogo = siteLogoDark || siteLogo
  const logoStyle = seoSettings.logo_style || 'logo-text'
  const showLogoImage = logoStyle !== 'text'
  const showBrandText = logoStyle !== 'logo'
  const footerAbout = seoSettings.footer_about || `Portal de notícias independente com cobertura completa da cidade e região.`
  const footerAddress = seoSettings.footer_address || ''
  const footerPhone = seoSettings.footer_phone || ''
  const footerEmail = seoSettings.footer_email || 'contato@portal.com'
  const footerCnpj = seoSettings.footer_cnpj || ''
  const cityState = [seoSettings.site_city, seoSettings.site_state].filter(Boolean).join(', ')

  return (
    <footer className="mt-auto bg-zinc-900 dark:bg-black text-zinc-300 dark:text-zinc-400">
      {/* Top CTA */}
      <div className="bg-primary py-6">
        <div className="news-container flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-white text-center md:text-left">
            <div className="text-xl" style={{ fontWeight: 500 }}>Anuncie no {siteName}</div>
            <div className="text-sm text-white/90"> Alcance milhares de leitores. Acumule créditos e anuncie grátis.</div>
          </div>
          <button
            onClick={() => handleNav({ name: 'store' })}
            className="bg-white text-primary px-6 py-3 rounded-lg hover:bg-zinc-100 transition-colors"
            style={{ fontWeight: 500 }}
          >
            <Flame className="inline h-4 w-4 mr-1" /> Quero Anunciar
          </button>
        </div>
      </div>

      {/* Main footer */}
      <div className="news-container py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div>
          <div className="mb-4 flex min-h-11 items-center gap-3">
            {showLogoImage && footerLogo ? (
              <img
                src={footerLogo}
                alt={siteName}
                className="h-10 w-auto max-w-[220px] object-contain"
                onError={(event) => {
                  const image = event.currentTarget
                  if (siteLogo && image.dataset.fallbackAttempted !== 'true') {
                    image.dataset.fallbackAttempted = 'true'
                    image.src = siteLogo
                    image.style.filter = 'brightness(0) invert(1)'
                  } else image.style.display = 'none'
                }}
              />
            ) : showLogoImage ? (
              <div className="bg-primary text-white text-xl px-2.5 py-1 rounded-lg" style={{ fontWeight: 600 }}>{siteInitials}</div>
            ) : null}
            {showBrandText && <div className="text-lg text-white" style={{ fontWeight: 600 }}>{siteName}</div>}
          </div>
          <p className="text-sm text-zinc-400 dark:text-zinc-500 mb-4">
            {footerAbout}
          </p>
          <div className="space-y-2 text-sm">
            {footerAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>{footerAddress}{cityState ? ` — ${cityState}` : ''}</span>
              </div>
            )}
            {footerPhone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <span>{footerPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <span>{footerEmail}</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-white mb-3 text-xs uppercase tracking-[0.2em]" style={{ fontWeight: 500 }}>Editorias</h3>
          <ul className="space-y-2 text-sm">
            {categories.slice(0, 6).map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => handleNav({ name: 'category', slug: c.slug })}
                  className="hover:text-primary transition-colors"
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-white mb-3 text-xs uppercase tracking-[0.2em]" style={{ fontWeight: 500 }}>Institucional</h3>
          <ul className="space-y-2 text-sm">
            <li><button onClick={() => handleNav({ name: 'about' })} className="hover:text-primary transition-colors">Sobre Nós</button></li>
            <li><button onClick={() => handleNav({ name: 'contact' })} className="hover:text-primary transition-colors">Contato</button></li>
            <li><button onClick={() => handleNav({ name: 'store' })} className="hover:text-primary transition-colors">Anuncie Conosco</button></li>
            <li><a href="#" className="hover:text-primary transition-colors">Política de Privacidade</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Termos de Uso</a></li>
            <li><button onClick={() => handleNav({ name: 'credits' })} className="hover:text-primary transition-colors">Programa de Pontos</button></li>
          </ul>
        </div>

        <div>
          <h3 className="text-white mb-3 text-xs uppercase tracking-[0.2em]" style={{ fontWeight: 500 }}>Siga-nos</h3>
          <div className="grid grid-cols-5 gap-2 mb-4">
            <SocialIcon href={socialLinks.facebook || '#'} label="Facebook">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </SocialIcon>
            <SocialIcon href={socialLinks.instagram || '#'} label="Instagram">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            </SocialIcon>
            <SocialIcon href={socialLinks.youtube || '#'} label="YouTube">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            </SocialIcon>
            <SocialIcon href={socialLinks.twitter || '#'} label="X">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </SocialIcon>
            <SocialIcon href={socialLinks.whatsapp || '#'} label="WhatsApp">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.738-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
            </SocialIcon>
          </div>
          <p className="text-xs text-zinc-500 mb-3">
            Receba as principais notícias no seu WhatsApp
          </p>
          <button
            onClick={() => handleNav({ name: 'register' })}
            className="bg-primary text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors w-full"
            style={{ fontWeight: 500 }}
          >
            Criar Conta e Ganhar Pontos
          </button>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-zinc-800">
        <div className="news-container py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
          <div>© {new Date().getFullYear()} {siteName}. Todos os direitos reservados.{footerCnpj ? ` CNPJ: ${footerCnpj}` : ''}</div>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white">Privacidade</a>
            <a href="#" className="hover:text-white">Termos</a>
            <a href="#" className="hover:text-white">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded bg-zinc-800 hover:bg-primary text-zinc-300 hover:text-white transition-colors"
    >
      {children}
    </a>
  )
}
