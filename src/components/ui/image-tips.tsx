'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Info, ChevronDown, ExternalLink } from 'lucide-react'

interface Props {
  /** Context-specific recommendations */
  context?: 'classified' | 'enterprise' | 'store' | 'general'
  className?: string
}

const RECOMMENDATIONS: Record<string, { dims: string; format: string; desc: string }> = {
  classified: { dims: '800×600px', format: 'JPG ou PNG', desc: 'Fotos do produto/anúncio' },
  enterprise: { dims: '400×100px', format: 'JPG ou PNG', desc: 'Banner do anúncio na categoria' },
  store: { dims: '1200×200px', format: 'JPG ou PNG', desc: 'Banner publicitário' },
  general: { dims: '800×600px', format: 'JPG ou PNG', desc: 'Imagem' },
}

const LOGO_RECOMMENDATION = { dims: '200×200px', format: 'PNG transparente', desc: 'Logo da empresa' }

export function ImageTips({ context = 'general', className }: Props) {
  const [open, setOpen] = useState(false)
  const rec = RECOMMENDATIONS[context] || RECOMMENDATIONS.general

  return (
    <div className={cn('bg-blue-50 border border-blue-200 rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-900 hover:bg-blue-100 transition-colors"
      >
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="font-medium">Como preparar suas imagens</span>
        <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs text-blue-900">
          {/* Dimensões recomendadas */}
          <div>
            <strong>📐 Dimensões recomendadas:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
              <li>{rec.desc}: <strong>{rec.dims}</strong> ({rec.format})</li>
              {context === 'enterprise' && (
                <li>{LOGO_RECOMMENDATION.desc}: <strong>{LOGO_RECOMMENDATION.dims}</strong> ({LOGO_RECOMMENDATION.format})</li>
              )}
            </ul>
          </div>

          {/* Formatos */}
          <div>
            <strong>🖼️ Formatos aceitos:</strong>
            <p className="mt-0.5 ml-2">JPG (menor tamanho), PNG (com transparência), WebP (melhor compressão). Evite BMP e TIFF.</p>
          </div>

          {/* Dicas para leigos */}
          <div>
            <strong>💡 Dicas para boas fotos:</strong>
            <ul className="list-disc list-inside mt-1 space-y-0.5 ml-2">
              <li>Tire fotos com boa iluminação (luz natural de preferência)</li>
              <li>Use o celular na horizontal para produtos</li>
              <li>Limpe a lente da câmera antes de fotografar</li>
              <li>Fotografe o objeto centralizado, sem cortes</li>
              <li>Evite fundos bagunçados — use parede lisa ou papel</li>
            </ul>
          </div>

          {/* Apps gratuitos para redimensionar */}
          <div>
            <strong>🔧 Apps gratuitos para redimensionar imagens:</strong>
            <div className="mt-1 space-y-1">
              <a href="https://www.iloveimg.com/pt/comprimir-imagem" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline ml-2">
                <ExternalLink className="h-3 w-3" /> iLoveIMG — compressar e redimensionar (online, sem cadastro)
              </a>
              <a href="https://imageresizer.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline ml-2">
                <ExternalLink className="h-3 w-3" /> ImageResizer — redimensionar online (simples e rápido)
              </a>
              <a href="https://www.remove.bg/pt-br" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline ml-2">
                <ExternalLink className="h-3 w-3" /> Remove.bg — remover fundo (deixa transparente para logos)
              </a>
              <a href="https://squoosh.app/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-700 hover:underline ml-2">
                <ExternalLink className="h-3 w-3" /> Squoosh — comprimir sem perder qualidade (do Google)
              </a>
            </div>
          </div>

          {/* Tamanho máximo */}
          <div className="bg-blue-100 rounded p-2">
            <strong>⚠️ Tamanho do arquivo:</strong> Máximo 5MB por imagem. Se a foto não enviar,
            use um dos apps acima para comprimir. Fotos de celular costumam ter 3-8MB —
            comprimir para menos de 1MB garante carregamento rápido.
          </div>
        </div>
      )}
    </div>
  )
}
