import { LocalNotifications } from '@capacitor/local-notifications'
import type { Settings } from './prefs'
import { GREAT_EVENING_SCORE } from './theme'
import type { DayForecast } from './weather'

/** How long before golden hour each alert fires. */
export const REMIND_BEFORE_MIN = 30
export const GREAT_BEFORE_MIN = 50
/** Only alert for the next few days — forecasts beyond that change too much. */
export const ALERT_DAYS = 3

const REMIND_ID = 1000
const GREAT_ID = 2000

export interface PlannedNotification {
  id: number
  at: Date
  title: string
  body: string
}

export interface NotificationText {
  remindTitle: (place: string) => string
  remindBody: (golden: string, sunset: string) => string
  greatTitle: (label: string, spot: string) => string
  greatBody: (score: number, golden: string, leaveInMin: number) => string
  label: (day: DayForecast) => string
  time: (d: Date) => string
}

/**
 * Which notifications to schedule: a golden-hour reminder for the current place, and an alert for
 * each saved spot scoring 55+ — the best spot per day only, so a great evening is one alert.
 * Pure, so the timing rules are unit-testable.
 */
export function planNotifications(
  settings: Settings,
  here: { name: string; days: DayForecast[] },
  spots: { name: string; days: DayForecast[] }[],
  now: number,
  text: NotificationText,
): PlannedNotification[] {
  const out: PlannedNotification[] = []
  if (settings.remindGoldenHour) {
    here.days.slice(0, ALERT_DAYS).forEach((d, i) => {
      const at = new Date(+d.times.goldenHour - REMIND_BEFORE_MIN * 60_000)
      if (+at > now) {
        out.push({
          id: REMIND_ID + i,
          at,
          title: text.remindTitle(here.name),
          body: text.remindBody(text.time(d.times.goldenHour), text.time(d.times.sunset)),
        })
      }
    })
  }
  if (settings.alertGreatEvenings) {
    for (let i = 0; i < ALERT_DAYS; i++) {
      const best = spots
        .map((s) => ({ name: s.name, day: s.days[i] }))
        .filter((s) => s.day && s.day.result.score >= GREAT_EVENING_SCORE)
        .sort((a, b) => b.day.result.score - a.day.result.score)[0]
      if (!best) continue
      const at = new Date(+best.day.times.goldenHour - GREAT_BEFORE_MIN * 60_000)
      if (+at <= now) continue
      out.push({
        id: GREAT_ID + i,
        at,
        title: text.greatTitle(text.label(best.day), best.name),
        body: text.greatBody(best.day.result.score, text.time(best.day.times.goldenHour), GREAT_BEFORE_MIN - 30),
      })
    }
  }
  return out
}

/** Ask for permission (only when the user turns an alert on). */
export async function ensurePermission(): Promise<boolean> {
  try {
    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true
    return (await LocalNotifications.requestPermissions()).display === 'granted'
  } catch {
    return false
  }
}

/**
 * Replace our scheduled notifications with `planned`. On Android/iOS these fire even when the app
 * is closed; in the PWA the plugin can only deliver them while the page is open.
 */
export async function reschedule(planned: PlannedNotification[]): Promise<void> {
  try {
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
    const ours = Array.from({ length: ALERT_DAYS }, (_, i) => [{ id: REMIND_ID + i }, { id: GREAT_ID + i }]).flat()
    await LocalNotifications.cancel({ notifications: ours })
    if (planned.length === 0) return
    await LocalNotifications.schedule({
      notifications: planned.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at, allowWhileIdle: true } })),
    })
  } catch {
    // Notifications unsupported here (e.g. a browser without the Notification API) — nothing to do.
  }
}
