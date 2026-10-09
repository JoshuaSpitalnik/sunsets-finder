import { weightedPathBlockage, type SunsetConditions } from './score'

export interface Cloud {
  /** Position and size as % of the sky box (x, y, w) and px (h). */
  x: number
  y: number
  w: number
  h: number
  color: string
  opacity: number
}

export interface SkyModel {
  top: string
  mid: string
  horizon: string
  seaTop: string
  /** 0–1: how warm the light is (from the score). */
  glow: number
  /** 0–1: how much sunlight reaches the clouds (low cloud on the light path blocks it). */
  lit: number
  sunGlow: string
  reflection: number
  clouds: Cloud[]
}

/** Small deterministic PRNG (mulberry32) so a day always draws the same clouds. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a string hash for seeding. */
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const mixColor = (a: number[], b: number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

/**
 * Colours of the simulated sky at sunset: warmer and redder with a higher score, clouds lit
 * pink/orange only when the light path to the west is clear.
 */
export function skyModel(c: SunsetConditions, score: number, seed: string): SkyModel {
  const glow = Math.min(1, score / 85)
  const lit = (1 - weightedPathBlockage(c.pathLowCloud) / 100) ** 1.5
  const r = rng(hash(`sky${seed}`))
  const clouds: Cloud[] = []
  for (let i = 0; i < Math.round(c.highCloud / 9); i++) {
    clouds.push({
      x: r() * 90 - 10,
      y: 36 + r() * 32,
      w: 30 + r() * 50,
      h: 3 + r() * 4,
      color: mixColor([110, 110, 128], [255, 150, 130], lit * glow),
      opacity: 0.7,
    })
  }
  for (let i = 0; i < Math.round(c.midCloud / 12); i++) {
    clouds.push({
      x: r() * 90 - 5,
      y: 50 + r() * 18,
      w: 14 + r() * 22,
      h: 8 + r() * 8,
      color: mixColor([90, 92, 110], [240, 120, 110], lit * glow * 0.85),
      opacity: 0.8,
    })
  }
  return {
    top: '#17203A',
    mid: mixColor([62, 72, 104], [190, 84, 112], glow * 0.85),
    horizon: mixColor([140, 146, 160], [255, 146, 84], glow),
    seaTop: mixColor([60, 64, 84], [190, 110, 90], glow),
    glow,
    lit,
    sunGlow: `0 0 ${Math.round(24 + glow * 46)}px ${Math.round(8 + glow * 18)}px rgba(255,170,100,${(0.3 + glow * 0.45).toFixed(2)})`,
    reflection: 0.3 + 0.7 * lit * glow,
    clouds,
  }
}
