import type { SunsetTimes } from './sun'

export type Phase = 'before' | 'golden' | 'peak' | 'blue' | 'over'

/** Where `now` sits in tonight's light. */
export function phaseAt(t: SunsetTimes, now: number): Phase {
  if (now < +t.goldenHour) return 'before'
  if (now < +t.sunset) return 'golden'
  if (now < +t.peakColorEnd) return 'peak'
  if (now < +t.dusk) return 'blue'
  return 'over'
}

/** Evening mode runs from golden hour until blue hour ends. */
export const isEvening = (t: SunsetTimes, now: number) => {
  const p = phaseAt(t, now)
  return p === 'golden' || p === 'peak' || p === 'blue'
}

/** Whole minutes from now until `to`, never negative. */
export const minutesUntil = (to: Date, now: number) => Math.max(0, Math.round((+to - now) / 60_000))

/** Positions (% of the bar) for the light timeline: 10 min before golden hour to 5 min after blue hour. */
export function timelineLayout(t: SunsetTimes, now: number) {
  const t0 = +t.goldenHour - 10 * 60_000
  const t1 = +t.dusk + 5 * 60_000
  const pct = (v: number) => ((v - t0) / (t1 - t0)) * 100
  return {
    golden: { start: pct(+t.goldenHour), size: pct(+t.sunset) - pct(+t.goldenHour) },
    peak: { start: pct(+t.sunset), size: pct(+t.peakColorEnd) - pct(+t.sunset) },
    blue: { start: pct(+t.peakColorEnd), size: pct(+t.dusk) - pct(+t.peakColorEnd) },
    now: now > t0 && now < t1 ? pct(now) : undefined,
  }
}

/** Share of the colour window (golden hour → end of blue hour) still to come, 0–1. */
export function colourLeft(t: SunsetTimes, now: number) {
  const total = +t.dusk - +t.goldenHour
  return Math.min(1, Math.max(0, (+t.dusk - now) / total))
}
