import type { LatLng } from './geo'

/** A real, freely licensed sunset photo taken near a point (from Wikimedia Commons). */
export interface SunsetPhoto {
  title: string
  thumbUrl: string
  pageUrl: string
  /** When the photo was taken, if the file says so. */
  takenAt?: Date
  artist?: string
  license?: string
  position?: LatLng
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const SEARCH_TERMS = 'sunset OR שקיעה OR dusk'

interface CommonsPage {
  title: string
  index?: number
  coordinates?: { lat: number; lon: number }[]
  imageinfo?: {
    thumburl?: string
    descriptionurl: string
    mime: string
    extmetadata?: Record<string, { value: string } | undefined>
  }[]
}

const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/**
 * Commons dates come in many shapes: "2014-01-01 16:06:06", "2.9.2024", "2019-05-03",
 * sometimes wrapped in HTML. Returns undefined when nothing date-like is found.
 */
export function parseCommonsDate(raw: string | undefined): Date | undefined {
  if (!raw) return undefined
  // Search the raw value too: ISO dates often hide in attributes like <time datetime="…">.
  const s = `${raw} ${stripHtml(raw)}`
  let m = s.match(/(\d{4})[-:/](\d{1,2})[-:/](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/)
  if (m) return validDate(+m[1], +m[2], +m[3], m[4] ? +m[4] : 12, m[5] ? +m[5] : 0)
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/) // day.month.year (Israeli / European)
  if (m) return validDate(+m[3], +m[2], +m[1], 12, 0)
  return undefined
}

function validDate(y: number, mo: number, d: number, h: number, mi: number): Date | undefined {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900) return undefined
  return new Date(y, mo - 1, d, h, mi)
}

export function parsePhotos(pages: CommonsPage[]): SunsetPhoto[] {
  return pages
    .slice()
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .flatMap((p) => {
      const info = p.imageinfo?.[0]
      if (!info?.thumburl || !info.mime.startsWith('image/')) return []
      const meta = info.extmetadata ?? {}
      const c = p.coordinates?.[0]
      return [
        {
          title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
          thumbUrl: info.thumburl,
          pageUrl: info.descriptionurl,
          takenAt: parseCommonsDate(meta.DateTimeOriginal?.value),
          artist: meta.Artist ? stripHtml(meta.Artist.value) : undefined,
          license: meta.LicenseShortName ? stripHtml(meta.LicenseShortName.value) : undefined,
          position: c ? { lat: c.lat, lng: c.lon } : undefined,
        },
      ]
    })
}

export async function fetchSunsetPhotos(at: LatLng, radiusKm = 10, signal?: AbortSignal): Promise<SunsetPhoto[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '24',
    gsrsearch: `${SEARCH_TERMS} nearcoord:${radiusKm}km,${at.lat.toFixed(4)},${at.lng.toFixed(4)}`,
    prop: 'imageinfo|coordinates',
    iiprop: 'url|extmetadata|mime',
    iiurlwidth: '480',
    iiextmetadatafilter: 'DateTimeOriginal|Artist|LicenseShortName',
  })
  const res = await fetch(`${COMMONS_API}?${params}`, { signal })
  if (!res.ok) throw new Error(`Photo search failed (${res.status})`)
  const json = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> } }
  return parsePhotos(Object.values(json.query?.pages ?? {}))
}
