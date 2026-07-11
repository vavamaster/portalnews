'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Newspaper, Award, Coins, ShoppingBag, Users, Mail, Phone, MapPin, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function StaticView({ type, seoSettings: propSettings }: { type: 'about' | 'contact'; seoSettings?: Record<string, string> }) {
  const { setView } = useAppStore()
  const [seoSettings, setSeoSettings] = useState<Record<string, string>>(propSettings || {})

  useEffect(() => {
    if (!propSettings) {
      fetch('/api/seo').then(r => r.json()).then(d => setSeoSettings(d.settings || {})).catch(() => {})
    }
  }, [propSettings])

  const siteName = seoSettings.site_name || 'Portal de Notícias'
  const siteAbout = seoSettings.site_about || 'Portal de notícias independente com cobertura completa da cidade e região.'
  const footerPhone = seoSettings.footer_phone || ''
  const footerEmail = seoSettings.footer_email || 'contato@portal.com'
  const footerAddress = seoSettings.footer_address || ''
  const cityState = [seoSettings.site_city, seoSettings.site_state].filter(Boolean).join(', ')

  if (type === 'about') {
    return (
      <div className="news-container py-8 animate-fade-in">
        <div className="max-w-3xl mx-auto">
          <h1 className="font-black text-3xl sm:text-4xl text-zinc-900 mb-4">Sobre o {siteName}</h1>

          <div className="prose-news">
            <p>
              O <strong>{siteName}</strong> {siteAbout.toLowerCase().replace(/^portal de notícias independente\.?\s*/, '')}
              {' '}Cobrimos o que acontece na cidade e na região, com jornalismo sério, ágil e isento. Nossa missão é
              levar informação de qualidade a cada cidadão, todos os dias.
            </p>

            <h2>Nossa missão</h2>
            <p>
              Buscamos ser a principal fonte de informação {cityState ? `de ${cityState}` : 'da cidade e região'}. Acreditamos que jornalismo de qualidade
              é pilar de uma democracia forte. Por isso, investimos em repórteres locais, em cobertura das sessões
              da câmara, em contato direto com a comunidade e em transparência editorial.
            </p>

            <h2>Programa de Pontos & Créditos</h2>
            <p>
              Inovamos ao recompensar nossos leitores. Acreditamos que informação de qualidade tem valor — e que
              esse valor deve ser compartilhado com quem nos lê. Por isso criamos um programa único:
            </p>
            <ul>
              <li><strong>Pontos por leitura</strong>: a cada 25% de uma notícia lida, você ganha pontos (limitado por post).</li>
              <li><strong>Pontos por reação</strong>: ao reagir às notícias, você também pontua.</li>
              <li><strong>Conversão em créditos</strong>: troque seus pontos por créditos (10 pontos = 1 crédito).</li>
              <li><strong>Anúncios grátis</strong>: use seus créditos para publicar anúncios no portal.</li>
            </ul>

            <h2>Editorias</h2>
            <p>
              Cobrimos todas as áreas essenciais para a comunidade: política, polícia, esportes, economia, cultura,
              educação, saúde, agronegócio, tecnologia e notícias gerais. Cada editoria tem foco local, com
              conexão regional e estadual quando necessário.
            </p>

            <h2>Contato</h2>
            <p>
              Quer falar com a redação? Tem uma pauta? Denúncia? Sugestão? Use nossa{' '}
              <button onClick={() => setView({ name: 'contact' })} className="text-primary underline">
                página de contato
              </button> ou nos chame no WhatsApp. Levamos cada mensagem a sério.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Feature icon={Newspaper} title="Jornalismo Local" desc={`Cobertura completa ${cityState ? `de ${cityState}` : 'da cidade e região'}`} />
            <Feature icon={Award} title="Recompensas" desc="Ganhe pontos lendo e reagindo" />
            <Feature icon={Users} title="Comunidade" desc="Conecte-se com outros leitores" />
          </div>

          <div className="mt-8 text-center">
            <Button onClick={() => setView({ name: 'register' })} className="bg-primary">
              Criar conta gratuita
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Contact
  return (
    <div className="news-container py-8 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-black text-3xl sm:text-4xl text-zinc-900 mb-4">Fale Conosco</h1>
        <p className="text-zinc-600 mb-6">
          Tem uma pauta, denúncia, sugestão ou deseja anunciar? Preencha o formulário ou use nossos canais diretos.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          {footerPhone && <ContactCard icon={Phone} title="Telefone" value={footerPhone} />}
          <ContactCard icon={Mail} title="Email" value={footerEmail} />
          {footerAddress && <ContactCard icon={MapPin} title="Endereço" value={footerAddress} />}
        </div>

        <ContactForm />
      </div>
    </div>
  )
}

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
      <Icon className="h-7 w-7 text-primary mx-auto mb-2" />
      <div className="font-bold text-zinc-900">{title}</div>
      <div className="text-xs text-zinc-600">{desc}</div>
    </div>
  )
}

function ContactCard({ icon: Icon, title, value }: { icon: any; title: string; value: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 text-center">
      <Icon className="h-6 w-6 text-primary mx-auto mb-1" />
      <div className="text-xs uppercase tracking-wider text-zinc-500">{title}</div>
      <div className="font-medium text-sm text-zinc-900">{value}</div>
    </div>
  )
}

function ContactForm() {
  const { toast } = useToast()
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: 'Sugestão de pauta', message: '' })
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await r.json()
      if (data.error) throw new Error(data.error)
      toast({ title: 'Mensagem enviada!', description: 'Entraremos em contato em breve.' })
      setForm({ name: '', email: '', phone: '', subject: 'Sugestão de pauta', message: '' })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-zinc-700">Nome *</label>
          <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700">Email *</label>
          <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-zinc-700">Telefone</label>
          <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-primary focus:outline-none" />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-700">Assunto</label>
          <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-primary focus:outline-none">
            <option>Sugestão de pauta</option>
            <option>Denúncia</option>
            <option>Dúvida</option>
            <option>Parceria / Anúncio</option>
            <option>Outro</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-700">Mensagem *</label>
        <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none" />
      </div>
      <Button type="submit" disabled={submitting} className="w-full bg-primary">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
        Enviar mensagem
      </Button>
    </form>
  )
}
