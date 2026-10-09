import { describe, expect, it } from 'vitest'
import { planNotifications, type NotificationText } from './notifications'
import { getSunsetTimes } from './sun'
import { addDays, type DayForecast } from './weather'
import type { Label } from './score'

const JAFFA = { lat: 32.0543, lng: 34.7516 }
const start = new Date('2026-10-09T09:00:00Z')

const days = (scores: number[]): DayForecast[] =>
  scores.map((score, i) => {
    const date = addDays(start, i)
    return {
      date,
      times: getSunsetTimes(date, JAFFA),
      conditions: {} as DayForecast['conditions'],
      result: { score, label: (score >= 75 ? 'epic' : score >= 55 ? 'great' : 'meh') as Label, reasons: [] },
    }
  })

const text: NotificationText = {
  remindTitle: (p) => `Golden hour soon at ${p}`,
  remindBody: (g, s) => `${g} / ${s}`,
  greatTitle: (l, s) => `${l} sunset at ${s}`,
  greatBody: (score, g, m) => `${score} ${g} ${m}`,
  label: (d) => d.result.label,
  time: (d) => d.toISOString().slice(11, 16),
}

describe('planNotifications', () => {
  const on = { remindGoldenHour: true, alertGreatEvenings: true }

  it('reminds 30 minutes before golden hour for the next 3 days', () => {
    const here = { name: 'Jaffa', days: days([10, 10, 10, 10, 10]) }
    const plan = planNotifications({ ...on, alertGreatEvenings: false }, here, [], +start, text)
    expect(plan).toHaveLength(3)
    expect(+here.days[0].times.goldenHour - +plan[0].at).toBe(30 * 60_000)
  })

  it('skips reminders whose time has passed', () => {
    const here = { name: 'Jaffa', days: days([10, 10, 10]) }
    const late = +here.days[0].times.goldenHour
    expect(planNotifications({ ...on, alertGreatEvenings: false }, here, [], late, text)).toHaveLength(2)
  })

  it('alerts once per day for the best spot scoring 55+', () => {
    const spots = [
      { name: 'Apollonia', days: days([60, 20, 90]) },
      { name: 'Jaffa Port', days: days([78, 30, 10]) },
    ]
    const plan = planNotifications({ ...on, remindGoldenHour: false }, { name: 'x', days: [] }, spots, +start, text)
    expect(plan.map((p) => p.title)).toEqual(['epic sunset at Jaffa Port', 'epic sunset at Apollonia'])
    expect(+spots[1].days[0].times.goldenHour - +plan[0].at).toBe(50 * 60_000)
  })

  it('plans nothing when both toggles are off', () => {
    const here = { name: 'Jaffa', days: days([90]) }
    expect(planNotifications({ remindGoldenHour: false, alertGreatEvenings: false }, here, [here], +start, text)).toEqual([])
  })
})
