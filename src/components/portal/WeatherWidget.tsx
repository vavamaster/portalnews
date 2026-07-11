'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  MapPin, ChevronDown, Search,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { POPULAR_CITIES } from '@/lib/weather'

interface WeatherData {
  city: string
  current: {
    temperature: number
    apparentTemperature: number
    humidity: number
    weatherCode: number
    weatherDescription: string
    weatherIcon: string
    windSpeed: number
    isDay: boolean
  }
  today: {
    maxTemp: number
    minTemp: number
    weatherDescription: string
    weatherIcon: string
  }
  forecast: Array<{
    date: string
    maxTemp: number
    minTemp: number
    weatherIcon: string
    weatherDescription: string
  }>
  updatedAt: string
  cached?: boolean
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [city, setCity] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('weather-city') || ''
    return ''
  })
  const [searchValue, setSearchValue] = useState('')

  const load = async (cityName?: string) => {
    try {
      const params = cityName ? `?city=${encodeURIComponent(cityName)}` : ''
      const res = await fetch(`/api/weather${params}`)
      const data = await res.json()
      if (data.error) {} else {
        setWeather(data)
        if (cityName) {
          setCity(data.city || cityName)
          if (typeof window !== 'undefined') localStorage.setItem('weather-city', data.city || cityName)
        }
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      try {
        const params = city ? `?city=${encodeURIComponent(city)}` : ''
        const res = await fetch(`/api/weather${params}`)
        const data = await res.json()
        if (isMounted) {
          if (!data.error) {
            setWeather(data)
          }
        }
      } catch {}
      if (isMounted) setLoading(false)
    }
    run()
    const interval = setInterval(run, 30 * 60 * 1000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [city])

  const handleSearch = async () => {
    if (!searchValue.trim()) return
    setLoading(true)
    await load(searchValue.trim())
    setSearchValue('')
  }

  const handleSelectCity = (cityName: string) => {
    setCity(cityName)
    load(cityName)
  }

  if (loading && !weather) return <span className="text-zinc-400 text-[11px]">...</span>
  if (!weather) return null

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Texto plano: temp + min/max + cidade — sem borda, sem ícone */}
        <button className="flex items-center gap-1 h-full text-zinc-600 hover:text-zinc-900 transition-colors whitespace-nowrap text-[11px]">
          <span className="text-zinc-800" style={{ fontWeight: 500 }}>{weather.current.temperature}°</span>
          <span className="text-zinc-400 text-[10px]">{weather.today.minTemp}°/{weather.today.maxTemp}°</span>
          <span className="text-zinc-400 text-[10px]">{weather.city}</span>
          <ChevronDown className="h-2 w-2 text-zinc-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-t-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm text-zinc-900" style={{ fontWeight: 500 }}>{weather.city}</span>
            </div>
            <span className="text-2xl">{weather.current.weatherIcon}</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-4xl font-numeric text-zinc-900" style={{ fontWeight: 500 }}>
              {weather.current.temperature}°C
            </span>
            <div className="text-xs text-zinc-600 mb-1">
              <div>{weather.current.weatherDescription}</div>
              <div>Sensação: {weather.current.apparentTemperature}°C</div>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-blue-100 text-xs text-zinc-600">
            <span>💧 {weather.current.humidity}%</span>
            <span>💨 {weather.current.windSpeed} km/h</span>
            <span>🌡️ {weather.today.minTemp}° / {weather.today.maxTemp}°</span>
          </div>
        </div>

        {/* Forecast */}
        <div className="p-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Próximos dias</div>
          <div className="grid grid-cols-3 gap-2">
            {weather.forecast.map((f, i) => (
              <div key={i} className="text-center p-2 rounded-lg bg-zinc-50">
                <div className="text-[10px] text-zinc-500 mb-1">{dayNames[new Date(f.date).getDay()]}</div>
                <div className="text-lg mb-0.5">{f.weatherIcon}</div>
                <div className="text-[10px] text-zinc-600">
                  <span className="text-zinc-900 font-numeric" style={{ fontWeight: 500 }}>{f.maxTemp}°</span>
                  <span className="text-zinc-400"> / {f.minTemp}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-t border-zinc-100">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Buscar cidade</div>
          <div className="flex gap-1.5">
            <Input value={searchValue} onChange={(e) => setSearchValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} placeholder="Nome da cidade..." className="h-8 text-xs" />
            <button onClick={handleSearch} className="flex items-center justify-center h-8 w-8 rounded-md bg-primary text-white hover:bg-blue-700 transition-colors flex-shrink-0">
              <Search className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Popular cities */}
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-zinc-500">Cidades populares</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-40 overflow-y-auto">
          {POPULAR_CITIES.map(c => (
            <DropdownMenuItem key={`${c.name}-${c.state}`} onClick={() => handleSelectCity(c.name)} className="cursor-pointer text-xs">
              <MapPin className="h-3 w-3 mr-1.5 text-zinc-400" />
              <span className="flex-1">{c.name}</span>
              <span className="text-zinc-400">{c.state}</span>
            </DropdownMenuItem>
          ))}
        </div>

        <div className="p-2 border-t border-zinc-100 text-center">
          <span className="text-[10px] text-zinc-400">
            {new Date(weather.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            {weather.cached && ' (cache)'}
          </span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
