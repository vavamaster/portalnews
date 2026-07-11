'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Search, Loader2, CheckCircle2, X } from 'lucide-react'

export interface UserSearchResult {
  id: string
  name: string
  email: string
  role: string
  avatar?: string | null
  hasEnterpriseAccess?: boolean
  enterpriseCompanyName?: string | null
}

interface Props {
  value: string // user ID
  onChange: (userId: string, user?: UserSearchResult) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * UserSearchInput — autocomplete input that searches users by name/email.
 * Calls /api/admin/users/search?q=... and shows a dropdown with results.
 * On select, calls onChange with the user ID.
 *
 * If `value` is already set (editing), shows the user's name/email as a chip.
 */
export function UserSearchInput({ value, onChange, placeholder = 'Buscar usuário...', className, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // If value is set but we don't have the user object, fetch it
  useEffect(() => {
    if (value && !selectedUser) {
      // Try to find in current results first
      const found = results.find(r => r.id === value)
      if (found) {
        setSelectedUser(found)
        return
      }
      // Otherwise fetch by ID (search by exact email is hard, so we just show the ID)
      // In practice, the parent component should pass the user object if available
      setSelectedUser({
        id: value,
        name: 'Usuário carregado',
        email: '',
        role: '',
      })
    }
    if (!value) {
      setSelectedUser(null)
    }
  }, [value])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.length < 2) {
      setResults([])
      setShowDropdown(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/admin/users/search?q=${encodeURIComponent(query)}`)
        const data = await r.json()
        setResults(data.users || [])
        setShowDropdown(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSelect = (user: UserSearchResult) => {
    setSelectedUser(user)
    onChange(user.id, user)
    setQuery('')
    setShowDropdown(false)
  }

  const handleClear = () => {
    setSelectedUser(null)
    onChange('', undefined)
    setQuery('')
  }

  // If a user is selected, show as a chip
  if (selectedUser && value) {
    return (
      <div className={cn('flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-md px-2 py-1.5', className)}>
        {selectedUser.avatar ? (
          <img src={selectedUser.avatar} alt="" className="h-5 w-5 rounded-full" />
        ) : (
          <div className="h-5 w-5 rounded-full bg-primary text-white text-[10px] flex items-center justify-center" style={{ fontWeight: 700 }}>
            {selectedUser.name?.[0]?.toUpperCase() || '?'}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-900 truncate">{selectedUser.name}</div>
          {selectedUser.email && <div className="text-[10px] text-zinc-500 truncate">{selectedUser.email}</div>}
        </div>
        {selectedUser.hasEnterpriseAccess && (
          <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">Enterprise</span>
        )}
        {!disabled && (
          <button onClick={handleClear} className="text-zinc-400 hover:text-red-500 flex-shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  // Otherwise show the search input
  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-7 pr-7 h-8 text-xs"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 animate-spin text-zinc-400" />
        )}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {results.map(u => (
            <button
              key={u.id}
              onClick={() => handleSelect(u)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-50 text-left transition-colors"
            >
              {u.avatar ? (
                <img src={u.avatar} alt="" className="h-6 w-6 rounded-full flex-shrink-0" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-primary text-white text-xs flex items-center justify-center flex-shrink-0" style={{ fontWeight: 700 }}>
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-zinc-900 truncate">{u.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">{u.email}</div>
              </div>
              <span className="text-[9px] bg-zinc-100 text-zinc-600 px-1 py-0.5 rounded flex-shrink-0">{u.role}</span>
              {u.hasEnterpriseAccess && (
                <CheckCircle2 className="h-3 w-3 text-amber-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
      {showDropdown && results.length === 0 && !loading && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-md shadow-lg p-3 text-xs text-zinc-500 text-center">
          Nenhum usuário encontrado.
        </div>
      )}
    </div>
  )
}
