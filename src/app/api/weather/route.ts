import { NextRequest, NextResponse } from 'next/server'
import { fetchWeather, geocodeCity, DEFAULT_CITY } from '@/lib/weather'
import { loadSeoSettings, getWeatherLocation } from '@/lib/seo-helpers'
import { handleApiError } from '@/lib/api-helpers'

// In-memory cache (30 minutes)
const cache = new Map<string, { data: any; expiresAt: number }>()
const CACHE_TTL = 30 * 60 * 1000 // 30 min

// GET /api/weather?city=City+Name OR /api/weather?lat=-16.95&lon=-53.52
// If no params, falls back to the city/lat/lon configured in /admin > SEO
// (weather_default_city, weather_default_lat, weather_default_lon).
// If those are not configured, falls back to Brasília (centro do Brasil).
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const city = url.searchParams.get('city')
    const lat = url.searchParams.get('lat')
    const lon = url.searchParams.get('lon')

    // Determine coordinates
    let latitude: number
    let longitude: number
    let cityName: string

    if (lat && lon) {
      latitude = parseFloat(lat)
      longitude = parseFloat(lon)
      cityName = city || `${lat},${lon}`
    } else if (city) {
      // Check if it's a known city in POPULAR_CITIES (has coordinates)
      const { POPULAR_CITIES } = await import('@/lib/weather')
      const known = POPULAR_CITIES.find(c =>
        c.name.toLowerCase() === city.toLowerCase() ||
        `${c.name} ${c.state}`.toLowerCase() === city.toLowerCase()
      )
      if (known) {
        latitude = known.lat
        longitude = known.lon
        cityName = known.name
      } else {
        // Try cache first
        const cacheKey = `geo:${city.toLowerCase()}`
        const cached = cache.get(cacheKey)
        if (cached && cached.expiresAt > Date.now()) {
          const geo = cached.data
          latitude = geo.latitude
          longitude = geo.longitude
          cityName = geo.city
        } else {
          // Geocode the city
          const geo = await geocodeCity(city)
          if (!geo) {
            // Fallback to default city coordinates
            latitude = DEFAULT_CITY.latitude
            longitude = DEFAULT_CITY.longitude
            cityName = DEFAULT_CITY.name
          } else {
            cache.set(cacheKey, { data: geo, expiresAt: Date.now() + CACHE_TTL * 6 })
            latitude = geo.latitude
            longitude = geo.longitude
            cityName = geo.city
          }
        }
      }
    } else {
      // No params → use SEO-configured city/lat/lon (admin sets this in /admin > SEO)
      const settings = await loadSeoSettings()
      const loc = getWeatherLocation(settings)
      if (loc.lat !== null && loc.lon !== null) {
        latitude = loc.lat
        longitude = loc.lon
        cityName = loc.city || DEFAULT_CITY.name
      } else {
        // Last-resort fallback (admin hasn't configured anything)
        latitude = DEFAULT_CITY.latitude
        longitude = DEFAULT_CITY.longitude
        cityName = DEFAULT_CITY.name
      }
    }

    // Check weather cache
    const weatherCacheKey = `weather:${latitude},${longitude}`
    const weatherCached = cache.get(weatherCacheKey)
    if (weatherCached && weatherCached.expiresAt > Date.now()) {
      return NextResponse.json({ ...weatherCached.data, cached: true })
    }

    // Fetch weather
    const weather = await fetchWeather(latitude, longitude, cityName)
    if (!weather) {
      return NextResponse.json({ error: 'Não foi possível obter a previsão do tempo' }, { status: 503 })
    }

    // Cache the result
    cache.set(weatherCacheKey, { data: weather, expiresAt: Date.now() + CACHE_TTL })

    return NextResponse.json({ ...weather, cached: false })
  } catch (e: any) {
    return handleApiError(e, 'weather')
  }
}
