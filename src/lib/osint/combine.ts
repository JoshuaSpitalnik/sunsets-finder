import { labelFor } from '../score'
import { isoDate, type DayForecast } from '../weather'
import type { DayOsint, Lead, Reliability } from './types'

/** Most a day's score can move because of forecasters, either way. */
export const MAX_ADJUSTMENT = 12
/** One chatty source can't outweigh the rest: its signal per day is capped. */
const PER_SOURCE_CAP = 5
/** Signal at which the nudge reaches ~76% of the maximum. */
const SCALE = 5

export const RELIABILITY_WEIGHT: Record<Reliability, number> = { off: 0, low: 0.3, medium: 0.6, high: 0.9 }

/** Fresh posts count fully; after three days they no longer count. */
export function recency(publishedAt: string, now: number): number {
  const hours = (now - Date.parse(publishedAt)) / 3_600_000
  if (hours < -1) return 0 // from the future: bad clock or bad data
  if (hours <= 12) return 1
  if (hours <= 24) return 0.8
  if (hours <= 48) return 0.55
  if (hours <= 72) return 0.35
  return 0
}

/**
 * How much forecasters move one day's score: each lead weighted by its source's reliability and
 * how fresh it is, summed per source (capped), then squashed into ±MAX_ADJUSTMENT points.
 */
export function dayOsint(leads: Lead[], date: string, reliabilityOf: (sourceId: string) => Reliability, now: number): DayOsint {
  const bySource = new Map<string, number>()
  const used: { lead: Lead; contribution: number }[] = []
  for (const lead of leads) {
    if (lead.date !== date) continue
    const contribution = lead.weight * recency(lead.publishedAt, now) * RELIABILITY_WEIGHT[reliabilityOf(lead.sourceId)]
    if (contribution === 0) continue
    bySource.set(lead.sourceId, (bySource.get(lead.sourceId) ?? 0) + contribution)
    used.push({ lead, contribution })
  }
  let signal = 0
  for (const s of bySource.values()) signal += Math.max(-PER_SOURCE_CAP, Math.min(PER_SOURCE_CAP, s))
  return {
    adjustment: Math.round(MAX_ADJUSTMENT * Math.tanh(signal / SCALE)),
    leads: used.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).map((u) => u.lead),
  }
}

/**
 * Days with forecasters' nudge applied: `result` holds the adjusted score and label (so every
 * screen shows it), `modelScore` keeps the weather-only score and `osint` explains the difference.
 */
export function applyOsint(
  days: DayForecast[],
  leads: Lead[],
  reliabilityOf: (sourceId: string) => Reliability,
  now: number,
): DayForecast[] {
  return days.map((d) => {
    const o = dayOsint(leads, isoDate(d.date), reliabilityOf, now)
    if (o.leads.length === 0) return d
    const score = Math.max(0, Math.min(100, d.result.score + o.adjustment))
    return { ...d, modelScore: d.result.score, osint: o, result: { ...d.result, score, label: labelFor(score) } }
  })
}
