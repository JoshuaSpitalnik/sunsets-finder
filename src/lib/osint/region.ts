import type { LatLng } from '../geo'

/** Coarse forecast regions forecasters use in Israel. */
export type Region = 'north' | 'coast' | 'mountains' | 'south'

/** Which region a point belongs to (rough boxes, good enough to read forecasts against). */
export function regionOf(p: LatLng): Region {
  if (p.lat >= 32.55) return 'north'
  if (p.lat < 31.25) return 'south'
  if (p.lng >= 34.95) return 'mountains'
  return 'coast'
}

const HEB = '\\u05D0-\\u05EA'
const word = (body: string) => new RegExp(`(?<![${HEB}])(?:[ובהל]{1,2})?(?:${body})(?![${HEB}])`)

const MENTIONS: Record<Region, RegExp[]> = {
  north: [word('צפון|גליל|גולן|חיפה|כרמל|עמקים|העמקים|עמק\\s+יזרעאל|כנרת'), /\b(?:north(?:ern)?|galilee|golan|haifa)\b/i],
  coast: [word('מרכז|שפלה|מישור\\s+החוף|חוף|החוף|גוש\\s+דן|השרון|שרון|תל\\s+אביב'), /\b(?:coast(?:al)?|central|tel\s+aviv)\b/i],
  mountains: [word('הרים|ירושלים|שומרון|הר\\s+חברון'), /\b(?:mountains?|hills|jerusalem)\b/i],
  south: [word('דרום|נגב|הנגב|ערבה|אילת|ים\\s+המלח|מדבר\\s+יהודה'), /\b(?:south(?:ern)?|negev|eilat|arava|dead\s+sea)\b/i],
}

const NATIONWIDE = [word('כל\\s+הארץ|רוב\\s+הארץ|רוב\\s+האזורים|חלק\\s+גדול\\s+מהאזורים|ברחבי\\s+הארץ'), /\b(?:nationwide|across\s+the\s+country|most\s+areas)\b/i]

/**
 * Does this sentence apply to `region`? True when it names no region, says "the whole country",
 * or names this region.
 */
export function appliesTo(segment: string, region: Region): boolean {
  if (NATIONWIDE.some((r) => r.test(segment))) return true
  const named = (Object.keys(MENTIONS) as Region[]).filter((r) => MENTIONS[r].some((re) => re.test(segment)))
  return named.length === 0 || named.includes(region)
}
