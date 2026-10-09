import { Geolocation } from '@capacitor/geolocation'
import type { LatLng } from './geo'

export interface Place extends LatLng {
  /** Accuracy radius in metres — only for GPS fixes. */
  accuracyM?: number
  /** Human-readable name (from search / reverse geocoding), if known. */
  name?: string
  source: 'gps' | 'map' | 'fallback'
}

/** Jaffa port — a classic west-facing sunset spot, used when location permission is denied. */
export const FALLBACK_PLACE: Place = { lat: 32.0543, lng: 34.7516, source: 'fallback' }

/**
 * High-accuracy position. The Capacitor plugin uses native GPS inside the Android/iOS apps and
 * falls back to the browser Geolocation API in the PWA, so this works on every platform.
 */
export async function getUserLocation(): Promise<Place> {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: Math.round(pos.coords.accuracy),
      source: 'gps',
    }
  } catch {
    return FALLBACK_PLACE
  }
}

const NOMINATIM = 'https://nominatim.openstreetmap.org'

interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  name?: string
}

/** Address / place search, biased to Israel. Called only on submit (Nominatim allows 1 req/s). */
export async function searchPlaces(query: string, lang: string, signal?: AbortSignal): Promise<Place[]> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', 'accept-language': lang, countrycodes: 'il,ps' })
  const res = await fetch(`${NOMINATIM}/search?${params}`, { signal })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const results = (await res.json()) as NominatimResult[]
  return results.map((r) => ({ lat: +r.lat, lng: +r.lon, name: r.display_name, source: 'map' }))
}

/** Short place name for a tapped point, e.g. "יפו, תל אביב-יפו". */
export async function reverseGeocode(at: LatLng, lang: string, signal?: AbortSignal): Promise<string | undefined> {
  const params = new URLSearchParams({
    lat: at.lat.toFixed(5),
    lon: at.lng.toFixed(5),
    format: 'jsonv2',
    zoom: '14',
    'accept-language': lang,
  })
  const res = await fetch(`${NOMINATIM}/reverse?${params}`, { signal })
  if (!res.ok) return undefined
  const r = (await res.json()) as NominatimResult & { error?: string }
  if (r.error) return undefined
  return r.display_name.split(',').slice(0, 2).join(',').trim()
}

/** Turn-by-turn navigation links; on phones these open the installed app. */
export const wazeUrl = (at: LatLng) => `https://waze.com/ul?ll=${at.lat.toFixed(6)},${at.lng.toFixed(6)}&navigate=yes`
export const googleMapsUrl = (at: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${at.lat.toFixed(6)},${at.lng.toFixed(6)}`
