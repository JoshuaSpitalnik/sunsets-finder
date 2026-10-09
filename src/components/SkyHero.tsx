import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { isoDate, type DayForecast } from '../lib/weather'
import { skyModel } from '../lib/sky'
import { summaryKeys } from '../lib/score'

interface Props {
  day: DayForecast
  /** "Jaffa · Tonight" line above the score. */
  heading: string
  /** Header row (place button, bell) drawn on top of the sky. */
  header: ReactNode
}

/** Horizon line as a share of the hero's height. */
const HORIZON = 84

/**
 * Full-bleed simulated sky (design 1c) with tonight's score. The sky's colours, clouds, sun glow
 * and reflection come from the day's actual cloud layers, light path and score.
 */
export function SkyHero({ day, heading, header }: Props) {
  const { t } = useTranslation()
  const sky = skyModel(day.conditions, day.result.score, isoDate(day.date))
  const { head, detail } = summaryKeys(day.result)

  return (
    <section
      className="sky-hero"
      style={{
        background: `linear-gradient(180deg, ${sky.top} 0%, ${sky.mid} 46%, ${sky.horizon} ${HORIZON}%, ${sky.seaTop} ${HORIZON}%, #141B2C 100%)`,
      }}
    >
      <div className="sky-art" aria-hidden="true">
        {sky.clouds.map((c, i) => (
          <span
            key={i}
            className="sky-cloud"
            style={{
              left: `${c.x}%`,
              top: `${(c.y / 100) * HORIZON}%`,
              width: `${c.w}%`,
              height: `${c.h}px`,
              background: c.color,
              opacity: c.opacity,
            }}
          />
        ))}
        <span className="sky-sun" style={{ top: `${HORIZON}%`, boxShadow: sky.sunGlow }} />
        <span className="sky-reflection" style={{ top: `${HORIZON}%`, opacity: sky.reflection }} />
      </div>

      <div className="sky-content">
        {header}
        <div className="sky-score">
          <span className="sky-heading">{heading}</span>
          <bdi className="sky-number">{day.result.score}</bdi>
          <span className="sky-label">
            {t(`labels.${day.result.label}`)}
            {day.confidence && <span className="glass-pill">{t(`confidence.${day.confidence}`)}</span>}
          </span>
          <p className="sky-summary">
            {t(head)} {t(detail)}
          </p>
        </div>
      </div>
    </section>
  )
}
