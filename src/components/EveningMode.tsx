import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { colourLeft, minutesUntil, phaseAt } from '../lib/timeline'
import type { DayForecast } from '../lib/weather'

interface Props {
  day: DayForecast
  placeName: string
  now: number
  onExit: () => void
}

/**
 * Design 1b: from golden hour until blue hour ends, Tonight goes dark and becomes a live
 * "look west" screen with a ring counting down the colour left.
 */
export function EveningMode({ day, placeName, now, onExit }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  const phase = phaseAt(day.times, now)
  const live = phase === 'golden' || phase === 'peak' || phase === 'blue' ? phase : 'peak'
  const left = colourLeft(day.times, now)
  const minutes = minutesUntil(day.times.dusk, now)
  const clock = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

  return (
    <main className="evening">
      <header className="evening-head">
        <span className="evening-place">{placeName}</span>
        <span className="evening-sub">{t('evening.live', { phase: t(`evening.phase.${live}`) })}</span>
      </header>

      <div className="evening-score">
        <span className="evening-kicker">{t('evening.lookWest')}</span>
        <bdi className="evening-number">{day.result.score}</bdi>
        <span className="evening-label">{t(`labels.${day.result.label}`)}</span>
      </div>

      <div className="evening-ring" role="img" aria-label={`${f.duration(minutes)} ${t('evening.left')}`}>
        <span className="evening-ring-fill" style={{ background: `conic-gradient(from 0deg, #E06A33 0deg, #C93F62 ${left * 360}deg, rgba(255,255,255,0.06) ${left * 360}deg)` }} />
        <span className="evening-ring-inner">
          <bdi className="evening-clock">{clock}</bdi>
          <span className="evening-left">{t('evening.left')}</span>
        </span>
      </div>

      <p className="evening-sentence">{t(`evening.sentence.${live}`)}</p>

      <div className="evening-tiles">
        {(
          [
            ['sunset', day.times.sunset],
            ['peakEnds', day.times.peakColorEnd],
            ['blue', day.times.dusk],
          ] as const
        ).map(([key, d]) => (
          <div key={key} className="evening-tile">
            <span>{t(`evening.${key}`)}</span>
            <bdi>{f.time(d)}</bdi>
          </div>
        ))}
      </div>

      <button className="evening-exit" onClick={onExit}>
        {t('evening.full')}
      </button>
    </main>
  )
}
