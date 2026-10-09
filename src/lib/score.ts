/**
 * Sunset quality model. Pure functions only — all inputs come from weather.ts.
 *
 * The core idea: colourful sunsets need high/mid cloud overhead to act as a "canvas", and a clear
 * light path toward the sunset so the low sun can actually reach and light that canvas from below.
 */

export interface SunsetConditions {
  /** Cloud cover % at the viewer, at sunset. */
  highCloud: number
  midCloud: number
  lowCloud: number
  /** Low cloud % at points along the sunset azimuth, nearest first (25/50/100/200 km). */
  pathLowCloud: number[]
  /** Precipitation probability % at sunset. */
  precipProbability: number
  /** Rain in mm during the 6 hours before sunset. */
  rainBeforeMm: number
  visibilityM: number
  humidity: number
  /** Aerosol optical depth (550 nm); undefined when the air-quality forecast doesn't reach this day. */
  aod?: number
  /** Dust concentration µg/m³. */
  dust?: number
  /** 1–12, used for the seasonal tuning. */
  month: number
}

export type Label = 'meh' | 'nice' | 'great' | 'epic'
export type ReasonKey =
  | 'canvas'
  | 'tooMuchCloud'
  | 'clearSky'
  | 'clearPath'
  | 'blockedPath'
  | 'lowCloud'
  | 'rain'
  | 'postStorm'
  | 'crisp'
  | 'hazy'
  | 'aerosolGlow'
  | 'heavyDust'

export interface Reason {
  key: ReasonKey
  positive: boolean
}

export interface SunsetScore {
  score: number
  label: Label
  reasons: Reason[]
}

/** All tunable numbers live here so they can later be fitted against the user's own ratings. */
export const WEIGHTS = {
  base: 10,
  colorPotential: 60,
  clarity: 12,
  aerosol: 8,
  postStorm: 10,
  postStormWinter: 15,
  /** Distance weights for the light-path samples (25/50/100/200 km). */
  pathWeights: [0.2, 0.25, 0.3, 0.25],
  /** With no cloud canvas at all, a sunset can be "nice" at best. */
  clearSkyCap: 54,
  thresholds: { nice: 35, great: 55, epic: 75 },
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** How good the high+mid cloud amount is as a canvas: peaks between 30–60%. */
export function canvasQuality(cover: number): number {
  if (cover < 30) return 0.2 + (cover / 30) * 0.8
  if (cover <= 60) return 1
  return clamp(1 - ((cover - 60) / 40) * 0.75, 0.25, 1)
}

export function labelFor(score: number): Label {
  const t = WEIGHTS.thresholds
  if (score >= t.epic) return 'epic'
  if (score >= t.great) return 'great'
  if (score >= t.nice) return 'nice'
  return 'meh'
}

function weightedPathBlockage(pathLowCloud: number[]): number {
  if (pathLowCloud.length === 0) return 0
  let sum = 0
  let weight = 0
  pathLowCloud.forEach((c, i) => {
    const w = WEIGHTS.pathWeights[i] ?? WEIGHTS.pathWeights[WEIGHTS.pathWeights.length - 1]
    sum += c * w
    weight += w
  })
  return sum / weight
}

export function scoreSunset(c: SunsetConditions): SunsetScore {
  const reasons: Reason[] = []
  const winter = c.month >= 11 || c.month <= 3

  // 1. Colour potential = canvas overhead × how much sun reaches it.
  const canvas = clamp(c.highCloud + 0.8 * c.midCloud, 0, 100)
  const canvasQ = canvasQuality(canvas)
  const blockage = weightedPathBlockage(c.pathLowCloud)
  const pathClear = (1 - blockage / 100) ** 1.5
  let score = WEIGHTS.base + WEIGHTS.colorPotential * canvasQ * pathClear

  if (canvas < 10) reasons.push({ key: 'clearSky', positive: false })
  else if (canvasQ >= 0.8) reasons.push({ key: 'canvas', positive: true })
  else if (canvas > 80) reasons.push({ key: 'tooMuchCloud', positive: false })

  if (blockage <= 20) reasons.push({ key: 'clearPath', positive: true })
  else if (blockage >= 50) reasons.push({ key: 'blockedPath', positive: false })

  // 2. Clarity: visibility and humidity.
  const visQ = clamp(c.visibilityM / 20_000, 0, 1)
  const humQ = c.humidity <= 70 ? 1 : clamp(1 - (c.humidity - 70) / 30, 0, 1)
  const clarity = visQ * 0.6 + humQ * 0.4
  score += WEIGHTS.clarity * clarity
  if (clarity >= 0.9) reasons.push({ key: 'crisp', positive: true })
  else if (clarity < 0.5) reasons.push({ key: 'hazy', positive: false })

  // 3. Aerosols: a little dust/haze deepens the reds; heavy dust (sharav) mutes everything.
  if (c.aod !== undefined) {
    const heavyDust = c.aod > 0.6 || (c.dust ?? 0) > 200
    if (heavyDust) {
      score -= WEIGHTS.aerosol * 1.5
      reasons.push({ key: 'heavyDust', positive: false })
    } else if (c.aod >= 0.1 && c.aod <= 0.35) {
      score += WEIGHTS.aerosol
      reasons.push({ key: 'aerosolGlow', positive: true })
    }
  }

  // 4. Clearing after rain: washed air plus broken cloud — often the best sunsets of the year.
  if (c.rainBeforeMm >= 0.5 && c.precipProbability < 30) {
    score += winter ? WEIGHTS.postStormWinter : WEIGHTS.postStorm
    reasons.push({ key: 'postStorm', positive: true })
  }

  // 5. Penalties at the viewer.
  if (c.lowCloud > 40) {
    score -= (c.lowCloud - 40) * 0.4
    reasons.push({ key: 'lowCloud', positive: false })
  }
  if (c.precipProbability > 50) {
    score -= (c.precipProbability - 50) * 0.6
    reasons.push({ key: 'rain', positive: false })
  }

  if (canvas < 10) score = Math.min(score, WEIGHTS.clearSkyCap)

  const final = Math.round(clamp(score, 0, 100))
  return { score: final, label: labelFor(final), reasons }
}

export type Confidence = 'high' | 'medium' | 'low'

export function confidenceFor(daysAhead: number): Confidence {
  if (daysAhead <= 1) return 'high'
  if (daysAhead <= 3) return 'medium'
  return 'low'
}
