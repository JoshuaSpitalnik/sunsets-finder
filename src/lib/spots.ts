import type { LatLng } from './geo'
import { readJson, writeJson } from './prefs'

export interface Spot extends LatLng {
  name: string
  /** Town / area shown under the name. */
  area?: string
}

/** West-facing classics shown on first launch; the user can unsave any of them. */
export const SEED_SPOTS: Spot[] = [
  { lat: 32.1655, lng: 34.803, name: 'Apollonia Cliffs', area: 'Herzliya' },
  { lat: 32.0546, lng: 34.7505, name: 'Jaffa Port', area: 'Tel Aviv-Yafo' },
  { lat: 32.5023, lng: 34.8919, name: 'Caesarea Aqueduct', area: 'Caesarea' },
  { lat: 30.61, lng: 34.8019, name: 'Ramon Crater rim', area: 'Mitzpe Ramon' },
  { lat: 32.827, lng: 34.975, name: 'Stella Maris', area: 'Haifa' },
]

/** Hebrew names for the seed spots, keyed by their English name. */
export const SEED_NAMES_HE: Record<string, { name: string; area: string }> = {
  'Apollonia Cliffs': { name: 'מצוקי אפולוניה', area: 'הרצליה' },
  'Jaffa Port': { name: 'נמל יפו', area: 'תל אביב-יפו' },
  'Caesarea Aqueduct': { name: 'אמת המים בקיסריה', area: 'קיסריה' },
  'Ramon Crater rim': { name: 'שפת מכתש רמון', area: 'מצפה רמון' },
  'Stella Maris': { name: 'סטלה מאריס', area: 'חיפה' },
}

/** Display name/area in the app language (seed spots are translated; user spots keep their names). */
export function spotLabel(spot: Spot, lang: string): { name: string; area?: string } {
  const he = lang === 'he' ? SEED_NAMES_HE[spot.name] : undefined
  return he ?? { name: spot.name, area: spot.area }
}

const KEY = 'spots'
/** Two points within ~10 m are the same spot. */
const SAME = 1e-4

export const sameSpot = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < SAME && Math.abs(a.lng - b.lng) < SAME

export const loadSpots = () => readJson<Spot[]>(KEY, SEED_SPOTS)
export const saveSpots = (spots: Spot[]) => writeJson(KEY, spots)

/** Add the spot, or remove it if it is already saved. Returns the new list. */
export function toggleSpot(spots: Spot[], spot: Spot): Spot[] {
  return spots.some((s) => sameSpot(s, spot)) ? spots.filter((s) => !sameSpot(s, spot)) : [...spots, spot]
}
