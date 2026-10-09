import { useTranslation } from 'react-i18next'
import { localeFor } from '../i18n'
import type { SunsetTimes } from '../lib/sun'

const ARRIVE_BEFORE_GOLDEN_HOUR_MIN = 10

export function TimeBand({ times }: { times: SunsetTimes }) {
  const { t, i18n } = useTranslation()
  const fmt = new Intl.DateTimeFormat(localeFor(i18n.language), { hour: '2-digit', minute: '2-digit' })
  const arriveBy = new Date(times.goldenHour.getTime() - ARRIVE_BEFORE_GOLDEN_HOUR_MIN * 60_000)

  const rows: [string, string, string][] = [
    ['arriveBy', fmt.format(arriveBy), 'arrive'],
    ['goldenHour', fmt.format(times.goldenHour), 'golden'],
    ['sunset', fmt.format(times.sunset), 'sunset'],
    ['peakColor', `${fmt.format(times.sunset)}–${fmt.format(times.peakColorEnd)}`, 'peak'],
    ['dusk', fmt.format(times.dusk), 'blue'],
  ]

  return (
    <dl className="time-band">
      {rows.map(([key, value, tone]) => (
        <div key={key} className={`time-row time-${tone}`}>
          <dt>{t(`times.${key}`)}</dt>
          <dd>
            <bdi>{value}</bdi>
          </dd>
        </div>
      ))}
      <div className="time-row">
        <dt>{t('times.direction')}</dt>
        <dd>
          <bdi>
            {Math.round(times.azimuth)}°{' '}
            <span className="compass" style={{ rotate: `${times.azimuth}deg` }} aria-hidden="true">
              ↑
            </span>
          </bdi>
        </dd>
      </div>
    </dl>
  )
}
