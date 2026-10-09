import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { localeFor } from '.'
import { compassIndex } from '../lib/score'

/** Locale-aware formatters for the current app language, memoised per language. */
export function useFormat() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  return useMemo(() => {
    const locale = localeFor(lang)
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    const monthDay = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
    const full = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric' })
    const dayNum = new Intl.DateTimeFormat(locale, { day: 'numeric' })
    const narrowDays = Array.from({ length: 7 }, (_, i) =>
      // 2026-10-04 is a Sunday: Sunday-first like the Israeli week.
      new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(new Date(2026, 9, 4 + i)),
    )
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    const long = t('compass.long', { returnObjects: true }) as string[]
    const short = t('compass.short', { returnObjects: true }) as string[]
    return {
      lang,
      time: (d: Date) => time.format(d),
      weekdayShort: (d: Date) => weekdayShort.format(d),
      weekdayLong: (d: Date) => weekdayLong.format(d),
      monthDay: (d: Date) => monthDay.format(d),
      full: (d: Date) => full.format(d),
      dayNum: (d: Date) => dayNum.format(d),
      narrowDays,
      /** "2h 45m" / "45 min" */
      duration: (minutes: number) => {
        const m = Math.max(0, Math.round(minutes))
        return m >= 60 ? t('duration.hm', { h: Math.floor(m / 60), m: m % 60 }) : t('duration.m', { m })
      },
      /** "3 hours ago", "yesterday" */
      ago: (iso: string, now: number) => {
        const minutes = Math.round((Date.parse(iso) - now) / 60_000)
        if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute')
        const hours = Math.round(minutes / 60)
        if (Math.abs(hours) < 24) return relative.format(hours, 'hour')
        return relative.format(Math.round(hours / 24), 'day')
      },
      compassLong: (az: number) => long[compassIndex(az)],
      compassShort: (az: number) => short[compassIndex(az)],
    }
  }, [lang, t])
}
