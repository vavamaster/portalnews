// ============= WEATHER SERVICE =============
// Uses Open-Meteo API (free, no API key required)
// Geocoding: https://geocoding-api.open-meteo.com/v1/search?name=Alta+Garças&count=1&language=pt
// Weather: https://api.open-meteo.com/v1/forecast?latitude=-16.95&longitude=-53.52&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min

export interface WeatherData {
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
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
    weatherCode: number
    weatherDescription: string
    weatherIcon: string
  }
  forecast: Array<{
    date: string
    maxTemp: number
    minTemp: number
    weatherCode: number
    weatherDescription: string
    weatherIcon: string
  }>
  updatedAt: string
}

// WMO Weather codes → description + emoji icon
// https://open-meteo.com/en/docs#weather_variable_documentation
const WMO_CODES: Record<number, { description: string; icon: string; dayIcon: string; nightIcon: string }> = {
  0: { description: 'Céu limpo', icon: '☀️', dayIcon: '☀️', nightIcon: '🌙' },
  1: { description: 'Predom. limpo', icon: '🌤️', dayIcon: '🌤️', nightIcon: '🌙' },
  2: { description: 'Parc. nublado', icon: '⛅', dayIcon: '⛅', nightIcon: '☁️' },
  3: { description: 'Nublado', icon: '☁️', dayIcon: '☁️', nightIcon: '☁️' },
  45: { description: 'Névoa', icon: '🌫️', dayIcon: '🌫️', nightIcon: '🌫️' },
  48: { description: 'Névoa gelada', icon: '🌫️', dayIcon: '🌫️', nightIcon: '🌫️' },
  51: { description: 'Garoa leve', icon: '🌦️', dayIcon: '🌦️', nightIcon: '🌧️' },
  53: { description: 'Garoa mod.', icon: '🌦️', dayIcon: '🌦️', nightIcon: '🌧️' },
  55: { description: 'Garoa densa', icon: '🌧️', dayIcon: '🌧️', nightIcon: '🌧️' },
  56: { description: 'Garoa gelada', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  57: { description: 'Garoa gelada densa', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  61: { description: 'Chuva leve', icon: '🌦️', dayIcon: '🌦️', nightIcon: '🌧️' },
  63: { description: 'Chuva mod.', icon: '🌧️', dayIcon: '🌧️', nightIcon: '🌧️' },
  65: { description: 'Chuva forte', icon: '🌧️', dayIcon: '🌧️', nightIcon: '🌧️' },
  66: { description: 'Chuva gelada', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  67: { description: 'Chuva gelada forte', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  71: { description: 'Neve leve', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  73: { description: 'Neve mod.', icon: '❄️', dayIcon: '❄️', nightIcon: '❄️' },
  75: { description: 'Neve forte', icon: '❄️', dayIcon: '❄️', nightIcon: '❄️' },
  77: { description: 'Grãos de neve', icon: '❄️', dayIcon: '❄️', nightIcon: '❄️' },
  80: { description: 'Pancadas leves', icon: '🌦️', dayIcon: '🌦️', nightIcon: '🌧️' },
  81: { description: 'Pancadas mod.', icon: '🌧️', dayIcon: '🌧️', nightIcon: '🌧️' },
  82: { description: 'Pancadas fortes', icon: '⛈️', dayIcon: '⛈️', nightIcon: '⛈️' },
  85: { description: 'Neve leve', icon: '🌨️', dayIcon: '🌨️', nightIcon: '🌨️' },
  86: { description: 'Neve forte', icon: '❄️', dayIcon: '❄️', nightIcon: '❄️' },
  95: { description: 'Tempestade', icon: '⛈️', dayIcon: '⛈️', nightIcon: '⛈️' },
  96: { description: 'Tempestade c/ granizo', icon: '⛈️', dayIcon: '⛈️', nightIcon: '⛈️' },
  99: { description: 'Tempestade severa', icon: '⛈️', dayIcon: '⛈️', nightIcon: '⛈️' },
}

export function getWeatherInfo(code: number, isDay: boolean = true): { description: string; icon: string } {
  const info = WMO_CODES[code]
  if (!info) return { description: '—', icon: '🌡️' }
  return {
    description: info.description,
    icon: isDay ? info.dayIcon : info.nightIcon,
  }
}

// Geocode a city name → coordinates
export async function geocodeCity(cityName: string): Promise<{
  city: string
  state: string
  country: string
  latitude: number
  longitude: number
} | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=pt&format=json`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Portal-Noticias/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results || data.results.length === 0) return null
    const r = data.results[0]
    return {
      city: r.name,
      state: r.admin1 || '',
      country: r.country || '',
      latitude: r.latitude,
      longitude: r.longitude,
    }
  } catch (e) {
    console.error('Geocode failed:', e)
    return null
  }
}

// Fetch weather from Open-Meteo
export async function fetchWeather(lat: number, lon: number, cityName?: string): Promise<WeatherData | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      timezone: 'America/Cuiaba',
      forecast_days: '4',
    })
    const url = `https://api.open-meteo.com/v1/forecast?${params.toString()}`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Portal-Noticias/1.0' },
    })
    if (!res.ok) return null
    const data = await res.json()

    const currentCode = data.current?.weather_code ?? 0
    const isDay = data.current?.is_day === 1
    const currentInfo = getWeatherInfo(currentCode, isDay)

    const todayCode = data.daily?.weather_code?.[0] ?? 0
    const todayInfo = getWeatherInfo(todayCode, true)

    const forecast = (data.daily?.time || []).slice(1, 4).map((date: string, i: number) => {
      const code = data.daily.weather_code[i + 1] ?? 0
      const info = getWeatherInfo(code, true)
      return {
        date,
        maxTemp: Math.round(data.daily.temperature_2m_max[i + 1] ?? 0),
        minTemp: Math.round(data.daily.temperature_2m_min[i + 1] ?? 0),
        weatherCode: code,
        weatherDescription: info.description,
        weatherIcon: info.icon,
      }
    })

    return {
      city: cityName || '',
      state: '',
      country: '',
      latitude: lat,
      longitude: lon,
      current: {
        temperature: Math.round(data.current?.temperature_2m ?? 0),
        apparentTemperature: Math.round(data.current?.apparent_temperature ?? 0),
        humidity: data.current?.relative_humidity_2m ?? 0,
        weatherCode: currentCode,
        weatherDescription: currentInfo.description,
        weatherIcon: currentInfo.icon,
        windSpeed: Math.round(data.current?.wind_speed_10m ?? 0),
        isDay,
      },
      today: {
        maxTemp: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
        minTemp: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
        weatherCode: todayCode,
        weatherDescription: todayInfo.description,
        weatherIcon: todayInfo.icon,
      },
      forecast,
      updatedAt: new Date().toISOString(),
    }
  } catch (e) {
    console.error('Weather fetch failed:', e)
    return null
  }
}

// Default fallback coordinates — Brasília (centro do Brasil). Only used when the admin
// has NOT yet configured weather_default_city / weather_default_lat / weather_default_lon
// in /admin > SEO. The admin-configured values always win (see api/weather/route.ts).
export const DEFAULT_CITY = {
  name: 'Brasília',
  state: 'DF',
  latitude: -15.7939,
  longitude: -47.8828,
}

// Popular cities for quick selection — major Brazilian capitals only.
export const POPULAR_CITIES = [
  { name: 'São Paulo', state: 'SP', lat: -23.5505, lon: -46.6333 },
  { name: 'Brasília', state: 'DF', lat: -15.7939, lon: -47.8828 },
  { name: 'Rio de Janeiro', state: 'RJ', lat: -22.9068, lon: -43.1729 },
  { name: 'Belo Horizonte', state: 'MG', lat: -19.9167, lon: -43.9345 },
  { name: 'Curitiba', state: 'PR', lat: -25.4284, lon: -49.2733 },
  { name: 'Porto Alegre', state: 'RS', lat: -30.0346, lon: -51.2177 },
  { name: 'Goiânia', state: 'GO', lat: -16.6869, lon: -49.2648 },
  { name: 'Cuiabá', state: 'MT', lat: -15.6014, lon: -56.0979 },
  { name: 'Manaus', state: 'AM', lat: -3.1190, lon: -60.0217 },
  { name: 'Salvador', state: 'BA', lat: -12.9714, lon: -38.5014 },
]
