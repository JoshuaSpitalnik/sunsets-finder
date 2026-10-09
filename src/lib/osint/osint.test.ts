import { describe, expect, it } from 'vitest'
import { analyzePost, findDayRefs } from './analyze'
import { applyOsint, dayOsint, recency } from './combine'
import { appliesTo, regionOf } from './region'
import type { OsintPost } from './types'
import { getSunsetTimes } from '../sun'
import type { DayForecast } from '../weather'

/** Tal Shamai's WhatsApp post from Monday 5 Oct 2026. */
const TAL: OsintPost = {
  id: 'tal-1',
  sourceId: 'tal-shamai',
  publishedAt: '2026-10-05T06:30:00+03:00',
  text: `*היי חברים. היום נוח מאוד עם ענני נוצה. בשלישי גשם קצר בחלק גדול מהאזורים. החל מרביעי מתחמם:*

🌤️ *היום (שני)* הטמפרטורות יירדו מעט ויהיה נוח ברוב הארץ. קישוטים של ענני נוצה שגם עשויים לגרום לשקיעה יפה.
*לבוש:* קצר בכל הארץ. עליונית מהערב בהרים.`,
}

const cues = (post: OsintPost, region = regionOf({ lat: 32.05, lng: 34.75 })) =>
  analyzePost(post, region).leads.map((l) => `${l.date} ${l.cue} ${l.weight.toFixed(1)}`).sort()

describe('analyzePost', () => {
  it("reads Tal Shamai's Monday post: cirrus and a likely nice sunset Monday, rain Tuesday", () => {
    expect(cues(TAL)).toEqual(['2026-10-05 cirrus 3.0', '2026-10-05 sunset 2.4', '2026-10-06 rain -2.0'])
  })

  it('highlights the clue words in the text', () => {
    const { marks } = analyzePost(TAL, 'coast')
    const words = marks.map((m) => TAL.text.slice(m.start, m.end))
    expect(words).toContain('ענני נוצה')
    expect(words).toContain('לשקיעה יפה') // the ל prefix is part of the word
    expect(words).toContain('גשם')
  })

  it('ignores negated clues and partly-cloudy is not overcast', () => {
    const post = { ...TAL, text: 'מחר מעונן חלקית, ללא גשם.' }
    expect(cues(post)).toEqual(['2026-10-06 partlyCloudy 1.0'])
  })

  it('damps clues about another region', () => {
    const post = { ...TAL, text: 'הערב ייתכנו גשמים מקומיים קלים בדרום הנגב ובערבה.' }
    const [lead] = analyzePost(post, 'coast').leads
    expect(lead.otherRegion).toBe(true)
    expect(lead.weight).toBeCloseTo(-2 * 0.6 * 0.3)
  })

  it('uses the explicit day of IMS forecasts', () => {
    const post: OsintPost = { id: 'ims-1', sourceId: 'ims', publishedAt: TAL.publishedAt, forDate: '2026-10-07', text: 'היום: ענני נוצה. הלילה: בהיר.' }
    expect(cues(post)).toEqual(['2026-10-07 cirrus 3.0', '2026-10-07 clear -1.0'])
  })

  it('counts reports of past rain only weakly', () => {
    const post = { ...TAL, text: 'היום בבוקר ירדו גשמים מרשימים בצפון.' }
    expect(analyzePost(post, 'north').leads[0].weight).toBeCloseTo(-2 * 0.3)
  })

  it('reads English posts too', () => {
    const post = { ...TAL, text: 'Tomorrow: high clouds should give a colourful sunset along the coast.' }
    // "should" is a confident forecast, not a hedge.
    expect(cues(post)).toEqual(['2026-10-06 highCloud 2.5', '2026-10-06 sunset 4.0'])
  })
})

describe('findDayRefs', () => {
  const base = new Date(2026, 9, 5, 12) // Monday
  const iso = (s: string) => findDayRefs(s, base).flatMap((r) => r.dates.map((d) => d.toISOString().slice(0, 10)))
  it('resolves weekdays, relative days and dates', () => {
    expect(iso('בשלישי גשם')).toEqual(['2026-10-06'])
    expect(iso('*היום (שני)*')).toEqual(['2026-10-05', '2026-10-05'])
    expect(iso('מחרתיים')).toEqual(['2026-10-07'])
    expect(iso('🗓 שבת, 10/10')).toEqual(['2026-10-10', '2026-10-10'])
    expect(iso('בסוף השבוע')).toEqual(['2026-10-09', '2026-10-10'])
  })
  it('pushes long-range talk past tonight', () => {
    expect(iso('מערכת גשם בעוד כ8 ימים')).toEqual(['2026-10-13'])
    expect(iso('גשם בעוד שבוע')).toEqual(['2026-10-12'])
  })
  it('does not read "שני" (two) as Monday', () => {
    expect(iso('אל שני אירועים אפשריים')).toEqual([])
  })
})

describe('region', () => {
  it('maps points and region mentions', () => {
    expect(regionOf({ lat: 32.05, lng: 34.75 })).toBe('coast')
    expect(regionOf({ lat: 31.77, lng: 35.21 })).toBe('mountains')
    expect(regionOf({ lat: 32.83, lng: 34.98 })).toBe('north')
    expect(appliesTo('רוחות צפוניות ערות לאורך מישור החוף', 'coast')).toBe(true)
    expect(appliesTo('גשם בצפון', 'coast')).toBe(false)
    expect(appliesTo('גשם קצר בחלק גדול מהאזורים, בעיקר בצפון', 'coast')).toBe(true)
  })
})

describe('combining sources', () => {
  const now = Date.parse('2026-10-05T09:00:00+03:00')
  const { leads } = analyzePost(TAL, 'coast')

  it('weights by reliability and freshness, within ±12', () => {
    const medium = dayOsint(leads, '2026-10-05', () => 'medium', now)
    const high = dayOsint(leads, '2026-10-05', () => 'high', now)
    expect(medium.adjustment).toBeGreaterThan(0)
    expect(high.adjustment).toBeGreaterThan(medium.adjustment)
    expect(high.adjustment).toBeLessThanOrEqual(12)
    expect(dayOsint(leads, '2026-10-05', () => 'off', now)).toEqual({ adjustment: 0, leads: [] })
    expect(dayOsint(leads, '2026-10-06', () => 'medium', now).adjustment).toBeLessThan(0)
  })

  it('forgets posts older than three days', () => {
    expect(recency(TAL.publishedAt, now + 4 * 86_400_000)).toBe(0)
  })

  it('applies the nudge to the day and keeps the model score', () => {
    const date = new Date(2026, 9, 5, 12)
    const day: DayForecast = {
      date,
      times: getSunsetTimes(date, { lat: 32.05, lng: 34.75 }),
      conditions: {} as DayForecast['conditions'],
      result: { score: 50, label: 'nice', reasons: [] },
    }
    const [out] = applyOsint([day], leads, () => 'high', now)
    expect(out.modelScore).toBe(50)
    expect(out.result.score).toBe(50 + out.osint!.adjustment)
    expect(out.result.label).toBe('great')
  })
})
