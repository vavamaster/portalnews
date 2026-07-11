'use client'

import { useState, useRef } from 'react'
import { Upload, Link2, Loader2, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (url: string) => void
  label?: string
  placeholder?: string
  className?: string
}

export function ImageUpload({ value, onChange, label, placeholder, className }: Props) {
  const [mode, setMode] = useState<'url' | 'upload'>('url')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.error) {
        alert(data.error)
      } else {
        onChange(data.url)
      }
    } catch (err: any) {
      alert('Erro ao enviar arquivo: ' + err.message)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className={className}>
      {label && <label className="text-sm font-medium mb-1 block">{label}</label>}
      <div className="flex gap-1.5 mb-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
            mode === 'url' ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          )}
        >
          <Link2 className="h-3 w-3" /> URL
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors',
            mode === 'upload' ? 'bg-primary text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
          )}
        >
          <Upload className="h-3 w-3" /> Upload
        </button>
      </div>
      {mode === 'url' ? (
        <div className="flex gap-1.5">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder || 'https://...'}
          />
          {value && (
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange('')} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
            onChange={handleFile}
            className="hidden"
            id="file-upload"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Escolher arquivo</>
            )}
          </Button>
          {value && (
            <span className="text-xs text-zinc-500 truncate max-w-32">{value.split('/').pop()}</span>
          )}
        </div>
      )}
    </div>
  )
}
