import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { LABEL_COLOR } from '../lib/theme'
import type { DayForecast } from '../lib/weather'

interface Props {
  days: DayForecast[]
  selected: number
  onSelect: (i: number) => void
}

/** The 7-day strip from design 1c: selected day dark, others coloured by label. */
export function DayChips({ days, selected, onSelect }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  return (
    <div className="day-chips" role="tablist" aria-label={t('tonightScreen.theLight')}>
      {days.map((d, i) => (
        <button
          key={d.date.toDateString()}
          role="tab"
          aria-selected={i === selected}
          className="day-chip"
          style={i === selected ? undefined : { color: LABEL_COLOR[d.result.label], opacity: i > 3 ? 0.7 : 1 }}
          onClick={() => onSelect(i)}
          aria-label={`${i === 0 ? t('today') : f.weekdayLong(d.date)}: ${d.result.score}, ${t(`labels.${d.result.label}`)}`}
        >
          <span className="day-chip-name">{i === 0 ? t('today') : f.weekdayShort(d.date)}</span>
          <bdi className="day-chip-score">{d.result.score}</bdi>
        </button>
      ))}
    </div>
  )
}
