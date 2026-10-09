import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { isDense, leadingBlanks } from '../lib/calendar'
import { CALENDAR_FILL, LABEL_COLOR } from '../lib/theme'
import { isoDate, type DayForecast } from '../lib/weather'
import type { Label } from '../lib/score'

interface Props {
  days: DayForecast[]
  selectedKey: string
  onSelect: (key: string) => void
}

const LEGEND: Label[] = ['meh', 'nice', 'great', 'epic']

/** Month-style grid of past sunsets, one circle per day coloured by its label. */
export function CalendarHeatmap({ days, selectedKey, onSelect }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  if (days.length === 0) return null
  const dense = isDense(days.length)

  return (
    <>
      <div className={dense ? 'calendar calendar-dense' : 'calendar'}>
        {f.narrowDays.map((d, i) => (
          <span key={`h${i}`} className="calendar-head" aria-hidden="true">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks(days[0].date) }, (_, i) => (
          <span key={`b${i}`} aria-hidden="true" />
        ))}
        {days.map((d) => {
          const key = isoDate(d.date)
          const label = d.result.label
          return (
            <button
              key={key}
              className="calendar-day"
              aria-pressed={key === selectedKey}
              aria-label={`${f.full(d.date)}: ${d.result.score}, ${t(`labels.${label}`)}`}
              style={{ background: CALENDAR_FILL[label], color: label === 'meh' ? '#6B645B' : '#FFFFFF' }}
              onClick={() => onSelect(key)}
            >
              {dense ? '' : f.dayNum(d.date)}
            </button>
          )
        })}
      </div>
      <div className="legend">
        {LEGEND.map((l) => (
          <span key={l}>
            <span className="legend-dot" style={{ background: l === 'meh' ? CALENDAR_FILL.meh : LABEL_COLOR[l] }} />
            {t(`labels.${l}`)}
          </span>
        ))}
      </div>
    </>
  )
}
