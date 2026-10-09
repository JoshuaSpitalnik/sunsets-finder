import { describe, expect, it } from 'vitest'
import { getSunsetTimes } from './sun'
import { colourLeft, isEvening, minutesUntil, phaseAt, timelineLayout } from './timeline'
import { skyModel } from './sky'

const t = getSunsetTimes(new Date('2026-10-09T12:00:00Z'), { lat: 32.0543, lng: 34.7516 })

describe('timeline', () => {
  it('walks through the phases of the evening', () => {
    expect(phaseAt(t, +t.goldenHour - 1)).toBe('before')
    expect(phaseAt(t, +t.goldenHour + 1)).toBe('golden')
    expect(phaseAt(t, +t.sunset + 1)).toBe('peak')
    expect(phaseAt(t, +t.peakColorEnd + 1)).toBe('blue')
    expect(phaseAt(t, +t.dusk + 1)).toBe('over')
    expect(isEvening(t, +t.sunset)).toBe(true)
    expect(isEvening(t, +t.goldenHour - 60_000)).toBe(false)
  })

  it('lays out contiguous segments inside the bar', () => {
    const l = timelineLayout(t, +t.sunset)
    expect(l.golden.start).toBeGreaterThan(0)
    expect(l.golden.start + l.golden.size).toBeCloseTo(l.peak.start)
    expect(l.peak.start + l.peak.size).toBeCloseTo(l.blue.start)
    expect(l.blue.start + l.blue.size).toBeLessThan(100)
    expect(l.now).toBeCloseTo(l.peak.start)
    expect(timelineLayout(t, +t.goldenHour - 3_600_000).now).toBeUndefined()
  })

  it('counts colour left and minutes', () => {
    expect(colourLeft(t, +t.goldenHour)).toBe(1)
    expect(colourLeft(t, +t.dusk + 1)).toBe(0)
    expect(minutesUntil(t.sunset, +t.sunset - 90 * 60_000)).toBe(90)
    expect(minutesUntil(t.sunset, +t.sunset + 1)).toBe(0)
  })
})

describe('skyModel', () => {
  const c = {
    highCloud: 45, midCloud: 24, lowCloud: 0, pathLowCloud: [0, 0, 0, 0], precipProbability: 0,
    rainBeforeMm: 0, visibilityM: 30_000, humidity: 50, month: 10,
  }
  it('is deterministic per seed and draws clouds from cloud cover', () => {
    const a = skyModel(c, 80, '2026-10-09')
    expect(skyModel(c, 80, '2026-10-09')).toEqual(a)
    expect(a.clouds).toHaveLength(5 + 2)
  })
  it('dims the clouds when the light path is blocked', () => {
    expect(skyModel({ ...c, pathLowCloud: [100, 100, 100, 100] }, 80, 'x').lit).toBe(0)
    expect(skyModel(c, 80, 'x').lit).toBe(1)
  })
})
