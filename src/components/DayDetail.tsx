import { useTranslation } from 'react-i18next'
import type { DayForecast } from '../lib/weather'
import { ReasonChips } from './ReasonChips'
import { ScoreRing } from './ScoreRing'
import { SkyPreview } from './SkyPreview'
import { TimeBand } from './TimeBand'

export function DayDetail({ day, compact = false }: { day: DayForecast; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <>
      <section className="hero">
        <ScoreRing score={day.result.score} label={day.result.label} />
        {day.confidence && <p className="muted">{t(`confidence.${day.confidence}`)}</p>}
        <ReasonChips reasons={day.result.reasons} />
      </section>
      <SkyPreview conditions={day.conditions} score={day.result.score} seed={Math.floor(day.times.sunset.getTime() / 86_400_000)} />
      {!compact && <TimeBand times={day.times} />}
    </>
  )
}
