import { Geolocation } from '@capacitor/geolocation'
import type { LatLng } from './geo'

export interface UserLocation extends LatLng {
  /** Accuracy radius in metres; undefined for the fallback location. */
  accuracyM?: number
  isFallback: boolean
}

/** Jaffa port — a classic west-facing sunset spot, used when location permission is denied. */
export const FALLBACK_LOCATION: UserLocation = { lat: 32.0543, lng: 34.7516, isFallback: true }

/**
 * High-accuracy position. The Capacitor plugin uses native GPS inside the Android/iOS apps and
 * falls back to the browser Geolocation API in the PWA, so this works on every platform.
 */
export async function getUserLocation(): Promise<UserLocation> {
  try {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 })
    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracyM: Math.round(pos.coords.accuracy),
      isFallback: false,
    }
  } catch {
    return FALLBACK_LOCATION
  }
}
