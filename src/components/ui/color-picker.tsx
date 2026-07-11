'use client'

import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, Pipette } from 'lucide-react'

// Curated palettes — friendly, no jargon
const PRESETS: { name: string; colors: string[] }[] = [
  {
    name: 'Azul',
    colors: ['#2563eb', '#1d4ed8', '#0ea5e9', '#06b6d4', '#3b82f6'],
  },
  {
    name: 'Verde',
    colors: ['#16a34a', '#15803d', '#22c55e', '#10b981', '#059669'],
  },
  {
    name: 'Vermelho',
    colors: ['#dc2626', '#b91c1c', '#ef4444', '#e11d48', '#f43f5e'],
  },
  {
    name: 'Laranja',
    colors: ['#ea580c', '#c2410c', '#f97316', '#fb923c', '#f59e0b'],
  },
  {
    name: 'Roxo',
    colors: ['#7c3aed', '#6d28d9', '#8b5cf6', '#a855f7', '#9333ea'],
  },
  {
    name: 'Rosa',
    colors: ['#db2777', '#be185d', '#ec4899', '#f472b6', '#e11d48'],
  },
  {
    name: 'Marrom',
    colors: ['#92400e', '#78350f', '#b45309', '#a16207', '#713f12'],
  },
  {
    name: 'Cinza',
    colors: ['#374151', '#1f2937', '#4b5563', '#6b7280', '#111827'],
  },
]

// Convert hex to HSL for slider editing
function hexToHsl(hex: string): [number, number, number] {
  let r = 0, g = 0, b = 0
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16)
    g = parseInt(hex[2] + hex[2], 16)
    b = parseInt(hex[3] + hex[3], 16)
  } else if (hex.length === 7) {
    r = parseInt(hex.slice(1, 3), 16)
    g = parseInt(hex.slice(3, 5), 16)
    b = parseInt(hex.slice(5, 7), 16)
  }
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)]
}

function hslToHex(h: number, s: number, l: number): string {
  h /= 360; s /= 100; l /= 100
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1/6) return p + (q - p) * 6 * t
      if (t < 1/2) return q
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1/3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1/3)
  }
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Generate shades of a hue for the saturation/lightness grid
function genSwatches(hue: number): string[] {
  const swatches: string[] = []
  const lightnesses = [90, 80, 70, 60, 50, 40, 30, 20]
  const saturations = [30, 50, 70, 90]
  for (const l of lightnesses) {
    for (const s of saturations) {
      swatches.push(hslToHex(hue, s, l))
    }
  }
  return swatches
}

interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  className?: string
  label?: string
}

export function ColorPicker({ value, onChange, className, label }: ColorPickerProps) {
  // Use key prop pattern to avoid setState-in-effect
  // When value changes externally, the component re-mounts with the new initial state
  return (
    <ColorPickerInner
      key={value || 'default'}
      value={value}
      onChange={onChange}
      className={className}
      label={label}
    />
  )
}

function ColorPickerInner({ value, onChange, className, label }: ColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [activeHue, setActiveHue] = useState(() => {
    const v = value || '#2563eb'
    return hexToHsl(v)[0]
  })

  const handleEyedropper = async () => {
    // @ts-ignore - EyeDropper API not in standard lib yet
    if (typeof window !== 'undefined' && window.EyeDropper) {
      try {
        // @ts-ignore
        const result = await new window.EyeDropper().open()
        onChange(result.sRGBHex)
      } catch (e) {
        // user cancelled
      }
    }
  }

  const swatches = genSwatches(activeHue)
  const displayValue = value || '#2563eb'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Color preview + trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 h-9 px-2 rounded-md border border-zinc-200 hover:border-zinc-300 bg-white transition-colors flex-shrink-0"
            title="Abrir seletor de cores"
          >
            <span
              className="w-6 h-6 rounded-md border border-zinc-300 flex-shrink-0 shadow-inner"
              style={{ backgroundColor: displayValue }}
            />
            <span className="text-xs font-mono uppercase text-zinc-700 hidden sm:inline">{displayValue}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[300px] p-3"
          align="start"
          sideOffset={4}
        >
          <div className="space-y-3">
            {/* Current color + hex input */}
            <div className="flex items-center gap-2">
              <span
                className="w-10 h-10 rounded-lg border-2 border-zinc-200 flex-shrink-0 shadow-inner"
                style={{ backgroundColor: displayValue }}
              />
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Cor selecionada</label>
                <input
                  type="text"
                  value={displayValue.toUpperCase()}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v)
                  }}
                  className="w-full text-sm font-mono uppercase px-2 py-1 rounded border border-zinc-200 focus:border-primary focus:outline-none"
                  placeholder="#2563EB"
                />
              </div>
            </div>

            {/* Hue selector — friendly color family picker */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1.5 block">
                Família de cor
              </label>
              <div className="grid grid-cols-8 gap-1">
                {Array.from({ length: 24 }, (_, i) => i * 15).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setActiveHue(h)}
                    className={cn(
                      'h-7 rounded-md border-2 transition-all',
                      Math.abs(activeHue - h) < 8 ? 'border-zinc-900 scale-105' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: hslToHex(h, 70, 50) }}
                    title={`${h}°`}
                  />
                ))}
              </div>
            </div>

            {/* Shade grid (saturation × lightness) */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1.5 block">
                Escolha o tom
              </label>
              <div className="grid grid-cols-8 gap-1">
                {swatches.map((sw, i) => {
                  const isSelected = displayValue.toLowerCase() === sw.toLowerCase()
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChange(sw)}
                      className={cn(
                        'aspect-square rounded-md transition-all relative',
                        isSelected ? 'ring-2 ring-offset-1 ring-zinc-900 scale-105' : 'hover:scale-110 border border-zinc-200'
                      )}
                      style={{ backgroundColor: sw }}
                      title={sw.toUpperCase()}
                    >
                      {isSelected && (
                        <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Preset palettes */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-1.5 block">
                Cores sugeridas
              </label>
              <div className="space-y-1.5">
                {PRESETS.map(palette => (
                  <div key={palette.name} className="flex items-center gap-2">
                    <span className="text-[10px] text-zinc-500 w-12 flex-shrink-0">{palette.name}</span>
                    <div className="flex gap-1 flex-1">
                      {palette.colors.map(c => {
                        const isSelected = displayValue.toLowerCase() === c.toLowerCase()
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onChange(c)}
                            className={cn(
                              'h-6 flex-1 rounded-md transition-all relative',
                              isSelected ? 'ring-2 ring-offset-1 ring-zinc-900 scale-105' : 'hover:scale-110 border border-zinc-200'
                            )}
                            style={{ backgroundColor: c }}
                            title={`${palette.name} ${c.toUpperCase()}`}
                          >
                            {isSelected && (
                              <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Eyedropper (if supported) */}
            {/* @ts-ignore */}
            {typeof window !== 'undefined' && window.EyeDropper && (
              <button
                type="button"
                onClick={handleEyedropper}
                className="w-full flex items-center justify-center gap-2 py-1.5 rounded-md border border-zinc-200 hover:bg-zinc-50 text-xs text-zinc-600 transition-colors"
              >
                <Pipette className="h-3.5 w-3.5" />
                Capturar cor da tela
              </button>
            )}

            {/* Clear */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => onChange('#2563eb')}
                className="text-[10px] text-zinc-500 hover:text-zinc-700 underline"
              >
                Restaurar padrão
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs font-medium px-3 py-1 rounded-md bg-primary text-white hover:opacity-90"
              >
                Concluir
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {label && (
        <span className="text-xs text-zinc-500">{label}</span>
      )}
    </div>
  )
}
