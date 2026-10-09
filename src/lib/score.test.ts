import { describe, expect, it } from 'vitest'
import { canvasQuality, compassIndex, scoreSunset, summaryKeys, type SunsetConditions } from './score'

const base: SunsetConditions = {
  highCloud: 0,
  midCloud: 0,
  lowCloud: 0,
  pathLowCloud: [0, 0, 0, 0],
  precipProbability: 0,
  rainBeforeMm: 0,
  visibilityM: 30_000,
  humidity: 50,
  month: 10,
}

describe('scoreSunset', () => {
  it('caps a cloudless sky at "nice"', () => {
    const r = scoreSunset(base)
    expect(r.label).not.toBe('great')
    expect(r.label).not.toBe('epic')
    expect(r.reasons.map((x) => x.key)).toContain('clearSky')
  })

  it('rates high cirrus with a clear western horizon as great or better', () => {
    const r = scoreSunset({ ...base, highCloud: 45, midCloud: 10 })
    expect(r.score).toBeGreaterThanOrEqual(55)
    expect(r.reasons.map((x) => x.key)).toEqual(expect.arrayContaining(['canvas', 'clearPath']))
  })

  it('rates the same canvas poorly when low cloud blocks the light path', () => {
    const clear = scoreSunset({ ...base, highCloud: 45 })
    const blocked = scoreSunset({ ...base, highCloud: 45, pathLowCloud: [90, 95, 100, 100] })
    expect(blocked.score).toBeLessThan(35)
    expect(blocked.score).toBeLessThan(clear.score - 30)
    expect(blocked.reasons.map((x) => x.key)).toContain('blockedPath')
  })

  it('rates rain at sunset as meh', () => {
    const r = scoreSunset({ ...base, highCloud: 40, midCloud: 60, lowCloud: 90, precipProbability: 90 })
    expect(r.label).toBe('meh')
  })

  it('gives a winter post-storm clearing an epic score', () => {
    const r = scoreSunset({ ...base, highCloud: 35, midCloud: 25, rainBeforeMm: 4, aod: 0.15, month: 1 })
    expect(r.label).toBe('epic')
    expect(r.reasons.map((x) => x.key)).toContain('postStorm')
  })

  it('penalises heavy dust (sharav)', () => {
    const clean = scoreSunset({ ...base, highCloud: 40, aod: 0.2 })
    const dusty = scoreSunset({ ...base, highCloud: 40, aod: 1.2, dust: 400 })
    expect(dusty.score).toBeLessThan(clean.score)
    expect(dusty.reasons.map((x) => x.key)).toContain('heavyDust')
  })

  it('always stays within 0–100', () => {
    const worst = scoreSunset({ ...base, lowCloud: 100, precipProbability: 100, pathLowCloud: [100, 100, 100, 100], humidity: 100, visibilityM: 0 })
    expect(worst.score).toBeGreaterThanOrEqual(0)
    const best = scoreSunset({ ...base, highCloud: 50, rainBeforeMm: 10, aod: 0.2, month: 12 })
    expect(best.score).toBeLessThanOrEqual(100)
  })
})

describe('canvasQuality', () => {
  it('peaks in the 30–60% band', () => {
    expect(canvasQuality(45)).toBe(1)
    expect(canvasQuality(5)).toBeLessThan(0.5)
    expect(canvasQuality(100)).toBeLessThan(0.5)
  })
})

describe('summaryKeys', () => {
  it('prefers rain, then the canvas/light-path combination', () => {
    expect(summaryKeys({ label: 'meh', reasons: [{ key: 'rain', positive: false }, { key: 'canvas', positive: true }] }).detail).toBe('summary.detail.rain')
    expect(
      summaryKeys({ label: 'epic', reasons: [{ key: 'canvas', positive: true }, { key: 'clearPath', positive: true }] }),
    ).toEqual({ head: 'summary.head.epic', detail: 'summary.detail.canvasClearPath' })
    expect(summaryKeys({ label: 'nice', reasons: [] }).detail).toBe('summary.detail.mixed')
  })
})

describe('compassIndex', () => {
  it('maps bearings to 16 points', () => {
    expect(compassIndex(0)).toBe(0)
    expect(compassIndex(262)).toBe(12) // W
    expect(compassIndex(298)).toBe(13) // WNW
    expect(compassIndex(359)).toBe(0)
    expect(compassIndex(-90)).toBe(12)
  })
})
