import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ReasonChips } from '../components/ReasonChips'
import { ScoreRing } from '../components/ScoreRing'
import { TimeBand } from '../components/TimeBand'
import { WeekStrip } from '../components/WeekStrip'
import { getUserLocation, type UserLocation } from '../lib/location'
import { fetchSunsetForecast, type DayForecast } from '../lib/weather'

type State =
  | { status: 'locating' }
  | { status: 'loading'; location: UserLocation }
  | { status: 'ready'; location: UserLocation; days: DayForecast[] }
  | { status: 'error'; location: UserLocation }

export function Tonight() {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ status: 'locating' })
  const [selected, setSelected] = useState(0)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    const location = await getUserLocation()
    if (signal?.aborted) return
    setState({ status: 'loading', location })
    try {
      const days = await fetchSunsetForecast(location, signal)
      if (!signal?.aborted) setState({ status: 'ready', location, days })
    } catch {
      if (!signal?.aborted) setState({ status: 'error', location })
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const reload = () => {
    setState({ status: 'locating' })
    void load()
  }

  if (state.status === 'locating') return <p className="status">{t('locating')}</p>

  const { location } = state
  const coords = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`
  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(coords)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the coordinates stay visible and selectable.
    }
  }

  return (
    <main className="tonight">
      <section className="location">
        {location.isFallback ? (
          <p className="muted">{t('defaultLocation')}</p>
        ) : (
          <p className="muted">{t('accuracy', { m: location.accuracyM })}</p>
        )}
        <div className="coords">
          <bdi dir="ltr">{coords}</bdi>
          <button className="link" onClick={copyCoords}>
            {copied ? t('copied') : t('copyCoords')}
          </button>
          <button className="link" onClick={reload}>
            {t('refreshLocation')}
          </button>
        </div>
      </section>

      {state.status === 'loading' && <p className="status">{t('loadingForecast')}</p>}
      {state.status === 'error' && (
        <div className="status">
          <p>{t('error')}</p>
          <button onClick={reload}>{t('retry')}</button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <section className="hero">
            <ScoreRing score={state.days[selected].result.score} label={state.days[selected].result.label} />
            <p className="muted">{t(`confidence.${state.days[selected].confidence}`)}</p>
            <ReasonChips reasons={state.days[selected].result.reasons} />
          </section>
          <TimeBand times={state.days[selected].times} />
          <WeekStrip days={state.days} selected={selected} onSelect={setSelected} />
        </>
      )}
    </main>
  )
}
