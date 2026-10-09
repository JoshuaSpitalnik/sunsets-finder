import { useTranslation } from 'react-i18next'
import { localeFor } from '../i18n'
import type { DayForecast } from '../lib/weather'

interface Props {
  days: DayForecast[]
  selected: number
  onSelect: (index: number) => void
}

export function WeekStrip({ days, selected, onSelect }: Props) {
  const { t, i18n } = useTranslation()
  const weekday = new Intl.DateTimeFormat(localeFor(i18n.language), { weekday: 'short' })
  return (
    <div className="week" role="tablist" aria-label={t('week')}>
      {days.map((d, i) => (
        <button
          key={d.date.toDateString()}
          role="tab"
          aria-selected={i === selected}
          className={`day score-${d.result.label} confidence-${d.confidence}`}
          onClick={() => onSelect(i)}
        >
          <span className="day-name">{i === 0 ? t('today') : weekday.format(d.date)}</span>
          <bdi className="day-score">{d.result.score}</bdi>
          <span className="day-label">{t(`labels.${d.result.label}`)}</span>
        </button>
      ))}
    </div>
  )
}
