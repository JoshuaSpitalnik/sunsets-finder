import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import type { SunsetTimes } from '../lib/sun'
import { timelineLayout } from '../lib/timeline'

interface Props {
  times: SunsetTimes
  now: number
  /** Show the "now" marker (only for today). */
  isToday: boolean
  onMap: () => void
}

/** "The light": golden → peak → blue hour timeline, the four times, and which way to face. */
export function LightCard({ times, now, isToday, onMap }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  const l = timelineLayout(times, now)
  const seg = (s: { start: number; size: number }) => ({ insetInlineStart: `${s.start}%`, inlineSize: `${s.size}%` })

  return (
    <section className="card light-card">
      <h2 className="card-title">{t('tonightScreen.theLight')}</h2>
      <div className="timeline" aria-hidden="true">
        <span className="timeline-golden" style={seg(l.golden)} />
        <span className="timeline-peak" style={seg(l.peak)} />
        <span className="timeline-blue" style={seg(l.blue)} />
        {isToday && l.now !== undefined && <span className="timeline-now" style={{ insetInlineStart: `${l.now}%` }} />}
      </div>
      <dl className="light-times">
        {(
          [
            ['golden', times.goldenHour],
            ['sunset', times.sunset],
            ['peakEnds', times.peakColorEnd],
            ['blueEnds', times.dusk],
          ] as const
        ).map(([key, d]) => (
          // Label first for screen readers; CSS shows the time above it, as in the design.
          <div key={key}>
            <dt>{t(`tonightScreen.${key}`)}</dt>
            <dd>
              <bdi>{f.time(d)}</bdi>
            </dd>
          </div>
        ))}
      </dl>
      <hr className="hairline" />
      <div className="face-row">
        <div className="compass" aria-hidden="true">
          <span className="compass-n">N</span>
          <span className="compass-needle" style={{ transform: `rotate(${times.azimuth}deg)` }}>
            <span className="compass-stem" />
            <span className="compass-head" />
          </span>
        </div>
        <div className="face-text">
          <span className="face-title">
            {t('tonightScreen.face', { dir: f.compassLong(times.azimuth), az: Math.round(times.azimuth) })}
          </span>
          <span className="muted-sm">{t('tonightScreen.faceSub')}</span>
        </div>
        <button className="chip-button" onClick={onMap}>
          {t('tonightScreen.map')}
        </button>
      </div>
    </section>
  )
}
