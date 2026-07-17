'use client'

import { useRef, useState, useMemo, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Bold, Italic, Heading, Heading2, Heading3, List, ListOrdered, Quote, Code,
  Link2, Image as ImageIcon, Minus, Table, Strikethrough, Eye, EyeOff,
  Columns2, SpellCheck, Undo2, Redo2, Maximize2, Minimize2, Wand2,
} from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

interface HistoryStack {
  past: string[]
  future: string[]
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva o conteúdo da notícia em Markdown...',
  minHeight = 600,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [history, setHistory] = useState<HistoryStack>({ past: [], future: [] })
  const lastValueRef = useRef(value)

  // Track history when value changes (debounced via timer)
  useEffect(() => {
    if (value === lastValueRef.current) return
    const t = setTimeout(() => {
      setHistory(h => ({
        past: [...h.past.slice(-49), lastValueRef.current],
        future: [],
      }))
      lastValueRef.current = value
    }, 400)
    return () => clearTimeout(t)
  }, [value])

  const insertMarkdown = (before: string, after: string = '', placeholder: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.substring(start, end) || placeholder
    const newText = ta.value.substring(0, start) + before + selected + after + ta.value.substring(end)
    onChange(newText)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + selected.length
    }, 0)
  }

  const insertLine = (prefix: string, placeholder: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = ta.value.lastIndexOf('\n', start - 1) + 1
    const lineEnd = ta.value.indexOf('\n', start)
    const realLineEnd = lineEnd === -1 ? ta.value.length : lineEnd
    const currentLine = ta.value.substring(lineStart, realLineEnd) || placeholder
    const newText = ta.value.substring(0, lineStart) + prefix + currentLine + ta.value.substring(realLineEnd)
    onChange(newText)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = lineStart + prefix.length
      ta.selectionEnd = lineStart + prefix.length + currentLine.length
    }, 0)
  }

  const insertBlock = (block: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = ta.value.substring(start, end) || ''
    const before = ta.value.substring(0, start)
    const after = ta.value.substring(end)
    const needsNewlineBefore = before.length > 0 && !before.endsWith('\n')
    const needsNewlineAfter = after.length > 0 && !after.startsWith('\n')
    const newText = before + (needsNewlineBefore ? '\n' : '') + block + (needsNewlineAfter ? '\n' : '') + after
    onChange(newText)
    setTimeout(() => {
      ta.focus()
      ta.selectionStart = (needsNewlineBefore ? start + 1 : start) + block.length
      ta.selectionEnd = ta.selectionStart
    }, 0)
  }

  const handleLink = () => {
    const url = window.prompt('URL do link:', 'https://')
    if (!url) return
    insertMarkdown('[', `](${url})`, 'texto do link')
  }

  const handleImage = () => {
    const url = window.prompt('URL da imagem:', 'https://')
    if (!url) return
    const alt = window.prompt('Texto alternativo (alt):', 'imagem') || 'imagem'
    insertBlock(`![${alt}](${url})`)
  }

  const handleTable = () => {
    insertBlock(`| Coluna 1 | Coluna 2 | Coluna 3 |
|----------|----------|----------|
| célula   | célula   | célula   |
| célula   | célula   | célula   |`)
  }

  const handleUndo = () => {
    if (history.past.length === 0) return
    const previous = history.past[history.past.length - 1]
    setHistory(h => ({
      past: h.past.slice(0, -1),
      future: [lastValueRef.current, ...h.future].slice(0, 50),
    }))
    lastValueRef.current = previous
    onChange(previous)
  }

  const handleRedo = () => {
    if (history.future.length === 0) return
    const next = history.future[0]
    setHistory(h => ({
      past: [...h.past, lastValueRef.current].slice(-50),
      future: h.future.slice(1),
    }))
    lastValueRef.current = next
    onChange(next)
  }

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b' || e.key === 'B') { e.preventDefault(); insertMarkdown('**', '**', 'negrito'); return }
      if (e.key === 'i' || e.key === 'I') { e.preventDefault(); insertMarkdown('*', '*', 'itálico'); return }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); handleLink(); return }
      if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); handleUndo(); return }
      if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); handleRedo(); return }
    }
    // Tab inserts two spaces (instead of changing focus)
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = e.currentTarget
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const newText = ta.value.substring(0, start) + '  ' + ta.value.substring(end)
      onChange(newText)
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + 2
      }, 0)
    }
  }

  // Simple markdown to HTML for preview (subset)
  const preview = useMemo(() => markdownToHtml(value || placeholder), [value, placeholder])

  // Stats
  const stats = useMemo(() => {
    const text = value || ''
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.length
    const lines = text.split('\n').length
    const readTime = Math.max(1, Math.ceil(words / 200))
    return { words, chars, lines, readTime }
  }, [value])

  const toolbarButtons = [
    { icon: Heading, action: () => insertLine('## ', 'Título da Seção'), title: 'Título (H2)', group: 'format' },
    { icon: Heading2, action: () => insertLine('### ', 'Subtítulo'), title: 'Subtítulo (H3)', group: 'format' },
    { icon: Heading3, action: () => insertLine('#### ', 'Sub-subtítulo'), title: 'Sub-subtítulo (H4)', group: 'format' },
    { icon: Bold, action: () => insertMarkdown('**', '**', 'negrito'), title: 'Negrito (Ctrl+B)', group: 'style' },
    { icon: Italic, action: () => insertMarkdown('*', '*', 'itálico'), title: 'Itálico (Ctrl+I)', group: 'style' },
    { icon: Strikethrough, action: () => insertMarkdown('~~', '~~', 'tachado'), title: 'Tachado', group: 'style' },
    { icon: Code, action: () => insertMarkdown('`', '`', 'código'), title: 'Código inline', group: 'style' },
    { icon: List, action: () => insertLine('- ', 'item de lista'), title: 'Lista com marcadores', group: 'list' },
    { icon: ListOrdered, action: () => insertLine('1. ', 'item numerado'), title: 'Lista numerada', group: 'list' },
    { icon: Quote, action: () => insertLine('> ', 'citação'), title: 'Citação', group: 'block' },
    { icon: Minus, action: () => insertBlock('---'), title: 'Linha divisória', group: 'block' },
    { icon: Table, action: handleTable, title: 'Tabela', group: 'block' },
    { icon: Link2, action: handleLink, title: 'Link (Ctrl+K)', group: 'insert' },
    { icon: ImageIcon, action: handleImage, title: 'Imagem', group: 'insert' },
  ] as const

  const groups = ['format', 'style', 'list', 'block', 'insert'] as const

  // Fullscreen escape
  useEffect(() => {
    if (!isFullscreen) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [isFullscreen])

  const containerHeight = isFullscreen ? '100vh' : `${minHeight}px`

  return (
    <div className={cn(
      'border border-zinc-200 rounded-xl overflow-hidden bg-white flex flex-col shadow-sm',
      isFullscreen && 'fixed inset-0 z-[100] rounded-none border-0'
    )}>
      {/* === Toolbar === */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-zinc-100/50 flex-wrap">
        {/* eslint-disable-next-line react-hooks/refs */}
        {groups.map((group, gi) => (
          <div key={group} className="flex items-center gap-0.5">
            {gi > 0 && <div className="w-px h-5 bg-zinc-300 mx-1" />}
            {toolbarButtons.filter(b => b.group === group).map((btn, i) => {
              const Icon = btn.icon
              return (
                <button
                  key={`${group}-${i}`}
                  type="button"
                  onClick={btn.action}
                  title={btn.title}
                  className="p-1.5 rounded-md hover:bg-white hover:shadow-sm active:scale-90 transition-all text-zinc-600 hover:text-zinc-900"
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        ))}

        <div className="w-px h-5 bg-zinc-300 mx-1" />

        {/* Undo / Redo */}
        <button
          type="button"
          onClick={handleUndo}
          disabled={history.past.length === 0}
          title="Desfazer (Ctrl+Z)"
          className="p-1.5 rounded-md hover:bg-white hover:shadow-sm active:scale-90 transition-all text-zinc-600 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={history.future.length === 0}
          title="Refazer (Ctrl+Y)"
          className="p-1.5 rounded-md hover:bg-white hover:shadow-sm active:scale-90 transition-all text-zinc-600 hover:text-zinc-900 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="flex-1" />

        {/* View toggles */}
        <div className="flex items-center gap-0.5 bg-zinc-200/60 rounded-md p-0.5">
          <button
            type="button"
            onClick={() => setShowPreview(false)}
            title="Apenas editor"
            className={cn(
              'p-1.5 rounded transition-all',
              !showPreview ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <EyeOff className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            title="Editor + Preview"
            className={cn(
              'p-1.5 rounded transition-all',
              showPreview ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
            )}
          >
            <Columns2 className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          title={isFullscreen ? 'Sair da tela cheia (Esc)' : 'Tela cheia'}
          className="p-1.5 rounded-md hover:bg-white hover:shadow-sm active:scale-90 transition-all text-zinc-600 hover:text-zinc-900"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* === Editor + Preview === */}
      <div className="flex flex-1 min-h-0" style={{ minHeight: containerHeight, height: containerHeight }}>
        {/* Editor pane */}
        <div className={cn('flex flex-col min-w-0', showPreview ? 'w-1/2 border-r border-zinc-200' : 'w-full')}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            spellCheck
            className="flex-1 w-full p-4 outline-none resize-none font-mono text-sm text-zinc-800 placeholder:text-zinc-400 bg-white leading-relaxed custom-scrollbar"
            style={{ minHeight: '100%' }}
          />
        </div>

        {/* Preview pane */}
        {showPreview && (
          <div className="w-1/2 flex flex-col min-w-0 bg-zinc-50/40">
            <div className="px-3 py-1.5 border-b border-zinc-200 bg-white text-[10px] uppercase tracking-wider text-zinc-500 font-semibold flex items-center gap-1.5 flex-shrink-0">
              <Eye className="h-3 w-3" />
              Preview ao vivo
            </div>
            <div
              className="flex-1 overflow-y-auto p-6 prose prose-zinc prose-sm max-w-none custom-scrollbar"
              dangerouslySetInnerHTML={{ __html: preview }}
            />
          </div>
        )}
      </div>

      {/* === Status bar === */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-200 bg-gradient-to-b from-zinc-50/50 to-zinc-100/30 text-[10px] text-zinc-500 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <SpellCheck className="h-3 w-3" />
            {stats.words} palavras
          </span>
          <span className="text-zinc-300">·</span>
          <span>{stats.chars} caracteres</span>
          <span className="text-zinc-300">·</span>
          <span>{stats.lines} linhas</span>
          <span className="text-zinc-300">·</span>
          <span>~{stats.readTime} min de leitura</span>
        </div>
        <div className="flex items-center gap-2">
          <kbd className="px-1 py-0.5 bg-white border border-zinc-200 rounded text-[9px] font-mono">Ctrl+B</kbd>
          <kbd className="px-1 py-0.5 bg-white border border-zinc-200 rounded text-[9px] font-mono">Ctrl+I</kbd>
          <kbd className="px-1 py-0.5 bg-white border border-zinc-200 rounded text-[9px] font-mono">Ctrl+K</kbd>
        </div>
      </div>
    </div>
  )
}

// Minimal Markdown to HTML converter for preview (safe-ish — escapes HTML first)
function markdownToHtml(md: string): string {
  let s = md
  // Escape HTML
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  // Code blocks ```...```
  s = s.replace(/```([\s\S]*?)```/g, (_, code) =>
    `<pre class="bg-zinc-900 text-zinc-100 p-3 rounded-md overflow-x-auto text-xs"><code>${code.replace(/\n$/, '')}</code></pre>`
  )

  // Tables
  s = s.replace(/^\|(.+)\|\n\|([-:\s|]+)\|\n((?:\|.+\|\n?)+)/gm, (_, header, _align, body) => {
    const ths = header.split('|').map((t: string) => t.trim()).filter(Boolean)
    const rows = body.trim().split('\n').map((r: string) =>
      `<tr>${r.split('|').filter((c, i) => i > 0 && i < r.split('|').length - 1).map((c: string) => `<td>${c.trim()}</td>`).join('')}</tr>`
    ).join('')
    return `<div class="overflow-x-auto my-2"><table class="w-full border-collapse text-xs"><thead><tr>${ths.map((t: string) => `<th class="border border-zinc-300 bg-zinc-100 px-2 py-1 text-left font-semibold">${t}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
  })

  // Headings
  s = s.replace(/^####\s+(.+)$/gm, '<h4 class="text-sm font-bold mt-3 mb-1 text-zinc-800">$1</h4>')
  s = s.replace(/^###\s+(.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1 text-zinc-800">$1</h3>')
  s = s.replace(/^##\s+(.+)$/gm, '<h2 class="text-lg font-bold mt-4 mb-2 text-zinc-900">$1</h2>')
  s = s.replace(/^#\s+(.+)$/gm, '<h1 class="text-xl font-black mt-4 mb-2 text-zinc-900">$1</h1>')

  // Horizontal rule
  s = s.replace(/^---$/gm, '<hr class="border-zinc-200 my-4" />')

  // Blockquote
  s = s.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="border-l-4 border-zinc-300 pl-3 py-1 my-2 text-zinc-600 italic text-xs">$1</blockquote>')

  // Bold, italic, strikethrough, code inline
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-zinc-900">$1</strong>')
  s = s.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
  s = s.replace(/~~([^~]+)~~/g, '<del class="line-through text-zinc-500">$1</del>')
  s = s.replace(/`([^`]+)`/g, '<code class="bg-zinc-100 text-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')

  // Images
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const safeUrl = safeMarkdownUrl(url, true)
    return safeUrl ? `<img alt="${alt}" src="${safeUrl}" class="my-2 rounded-md max-w-full h-auto" />` : alt
  })

  // Links
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safeUrl = safeMarkdownUrl(url, false)
    return safeUrl ? `<a href="${safeUrl}" class="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">${label}</a>` : label
  })

  // Lists
  s = s.replace(/^(\s*)[-*+]\s+(.+)$/gm, '<li class="ml-4 list-disc text-xs">$2</li>')
  s = s.replace(/^(\s*)\d+\.\s+(.+)$/gm, '<li class="ml-4 list-decimal text-xs">$2</li>')
  // Wrap consecutive <li> in <ul>
  s = s.replace(/(<li[^>]*>.*?<\/li>(\n|$))+/g, (m) => `<ul class="my-2 space-y-0.5">${m}</ul>`)

  // Paragraphs (lines not wrapped in tags)
  s = s.split('\n\n').map(block => {
    const trimmed = block.trim()
    if (!trimmed) return ''
    if (/^<(h\d|ul|ol|pre|blockquote|hr|div|table|img)/.test(trimmed)) return trimmed
    // Single line break inside paragraph → <br>
    return `<p class="my-2 text-xs leading-relaxed text-zinc-700">${trimmed.replace(/\n/g, '<br>')}</p>`
  }).join('\n')

  return s
}

function safeMarkdownUrl(rawUrl: string, image: boolean) {
  const url = rawUrl.trim()
  const normalized = url.replace(/&amp;/gi, '&')
  if (/^(https?:\/\/|\/|\.\/|#)/i.test(normalized)) return url
  if (!image && /^(mailto:|tel:)/i.test(normalized)) return url
  if (image && /^data:image\/(png|jpeg|gif|webp|avif);base64,/i.test(normalized)) return url
  return ''
}
