import { describe, expect, it } from 'vitest'
import { buildConditions, type HourlySeries } from './weather'

const start = Date.UTC(2026, 9, 9, 0) / 1000
const hours = Array.from({ length: 24 }, (_, h) => start + h * 3600)
const series = (overrides: Record<string, (h: number) => number>): HourlySeries => {
  const s: HourlySeries = { time: hours }
  for (const [k, f] of Object.entries(overrides)) s[k] = hours.map((_, h) => f(h))
  return s
}

describe('buildConditions', () => {
  const sunset = new Date(Date.UTC(2026, 9, 9, 15, 10)) // nearest hour = 15:00 UTC

  it('reads values at the hour nearest sunset and sums rain over the prior 6 hours', () => {
    const viewer = series({
      cloud_cover_high: (h) => (h === 15 ? 40 : 0),
      cloud_cover_low: () => 5,
      precipitation: (h) => (h >= 9 && h < 15 ? 1 : 0),
      precipitation_probability: () => 10,
    })
    const path = [series({ cloud_cover_low: () => 70 })]
    const c = buildConditions(sunset, viewer, path)
    expect(c.highCloud).toBe(40)
    expect(c.rainBeforeMm).toBe(6)
    expect(c.pathLowCloud).toEqual([70])
    expect(c.month).toBe(10)
    expect(c.aod).toBeUndefined()
  })

  it('ignores air quality data that does not cover sunset', () => {
    const air: HourlySeries = { time: [start], aerosol_optical_depth: [0.2], dust: [10] }
    const c = buildConditions(sunset, series({}), [], air)
    expect(c.aod).toBeUndefined()
  })

  it('uses defaults for missing values', () => {
    const c = buildConditions(sunset, series({}), [])
    expect(c.visibilityM).toBe(20_000)
    expect(c.humidity).toBe(60)
  })
})
