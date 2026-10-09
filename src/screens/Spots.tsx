import { useTranslation } from 'react-i18next'
import { IconChevronEnd } from '../components/Icons'
import { useFormat } from '../i18n/useFormat'
import { spotLabel, type Spot } from '../lib/spots'
import { LABEL_COLOR, LABEL_TINT } from '../lib/theme'
import { pointKey, type ForecastState } from '../lib/useForecasts'
import type { DayForecast } from '../lib/weather'

interface Props {
  spots: Spot[]
  forecasts: Record<string, ForecastState>
  onOpen: (spot: Spot) => void
}

interface Ranked {
  spot: Spot
  today?: DayForecast
}

/** Saved spots ranked by tonight's score; spots still loading (or failed) sink to the bottom. */
export function Spots({ spots, forecasts, onOpen }: Props) {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const ranked: Ranked[] = spots
    .map((spot) => {
      const s = forecasts[pointKey(spot)]
      return { spot, today: s?.status === 'ready' ? s.days[0] : undefined }
    })
    .sort((a, b) => (b.today?.result.score ?? -1) - (a.today?.result.score ?? -1))

  const [best, ...rest] = ranked
  const label = (r: Ranked) => spotLabel(r.spot, i18n.language)
  const area = (r: Ranked) => label(r).area ?? t('spots.savedPin')

  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('spots.title')}</h1>
        <p>{t('spots.sub')}</p>
      </header>

      {!best && <p className="status">{t('spots.empty')}</p>}

      {best && (
        <button className="card best-card" onClick={() => onOpen(best.spot)}>
          <span className="kicker">{t('spots.best')}</span>
          <span className="best-row">
            <span className="best-name">
              <span className="serif-title">{label(best).name}</span>
              <span className="muted-sm">
                {area(best)}
                {best.today && ` · ${t('spots.sunsetAt', { time: f.time(best.today.times.sunset) })}`}
              </span>
            </span>
            <span className="best-score" style={{ color: best.today ? LABEL_COLOR[best.today.result.label] : undefined }}>
              <bdi className="serif-number">{best.today?.result.score ?? '…'}</bdi>
              <span>{best.today ? t(`labels.${best.today.result.label}`) : ''}</span>
            </span>
          </span>
        </button>
      )}

      {rest.length > 0 && (
        <ul className="card spot-list">
          {rest.map((r) => (
            <li key={pointKey(r.spot)}>
              <button className="spot-row" onClick={() => onOpen(r.spot)}>
                <bdi
                  className="spot-score"
                  style={
                    r.today
                      ? { background: LABEL_TINT[r.today.result.label], color: LABEL_COLOR[r.today.result.label] }
                      : undefined
                  }
                >
                  {r.today?.result.score ?? '…'}
                </bdi>
                <span className="spot-text">
                  <span className="spot-name">{label(r).name}</span>
                  <span className="muted-sm">
                    {area(r)}
                    {r.today && ` · ${f.time(r.today.times.sunset)} · ${t(`labels.${r.today.result.label}`)}`}
                  </span>
                </span>
                <span className="spot-chevron">
                  <IconChevronEnd />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="fine-print center">{t('spots.addHint')}</p>
    </main>
  )
}
