import { describe, expect, it } from 'vitest'
import { getSunsetTimes } from './sun'
import { destination, distanceKm } from './geo'

const JAFFA = { lat: 32.0543, lng: 34.7516 }

const utcMinutes = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes()

describe('getSunsetTimes (Tel Aviv-Jaffa)', () => {
  it('summer solstice: sunset ≈ 16:49 UTC (19:49 IDT), azimuth ≈ 298°', () => {
    const t = getSunsetTimes(new Date('2026-06-21T12:00:00Z'), JAFFA)
    expect(Math.abs(utcMinutes(t.sunset) - (16 * 60 + 49))).toBeLessThanOrEqual(3)
    expect(t.azimuth).toBeGreaterThan(295)
    expect(t.azimuth).toBeLessThan(301)
  })

  it('winter solstice: sunset ≈ 14:39 UTC (16:39 IST), azimuth ≈ 242°', () => {
    const t = getSunsetTimes(new Date('2026-12-21T12:00:00Z'), JAFFA)
    expect(Math.abs(utcMinutes(t.sunset) - (14 * 60 + 39))).toBeLessThanOrEqual(3)
    expect(t.azimuth).toBeGreaterThan(239)
    expect(t.azimuth).toBeLessThan(245)
  })

  it('ends peak colour roughly 15–25 minutes after sunset', () => {
    const t = getSunsetTimes(new Date('2026-10-09T12:00:00Z'), JAFFA)
    const minutes = (t.peakColorEnd.getTime() - t.sunset.getTime()) / 60_000
    expect(minutes).toBeGreaterThan(12)
    expect(minutes).toBeLessThan(25)
  })

  it('orders golden hour < sunset < peak colour end < dusk', () => {
    const t = getSunsetTimes(new Date('2026-10-09T12:00:00Z'), JAFFA)
    expect(t.goldenHour < t.sunset).toBe(true)
    expect(t.sunset < t.peakColorEnd).toBe(true)
    expect(t.peakColorEnd < t.dusk).toBe(true)
  })
})

describe('geo', () => {
  it('destination is the inverse of distance', () => {
    const p = destination(JAFFA, 270, 100)
    expect(distanceKm(JAFFA, p)).toBeCloseTo(100, 1)
    expect(p.lng).toBeLessThan(JAFFA.lng)
  })
})
