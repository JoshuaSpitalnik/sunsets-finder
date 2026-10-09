import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DayDetail } from '../components/DayDetail'
import { PlaceHeader } from '../components/PlaceHeader'
import { WeekStrip } from '../components/WeekStrip'
import type { Place } from '../lib/location'
import { fetchSunsetForecast, type DayForecast } from '../lib/weather'

type State = { status: 'loading' } | { status: 'ready'; days: DayForecast[] } | { status: 'error' }

interface Props {
  place: Place
  onUseGps: () => void
  onOpenMap: () => void
}

/** Remount (key) when the place changes so the previous forecast never shows for a new spot. */
export function Tonight({ place, onUseGps, onOpenMap }: Props) {
  const { t } = useTranslation()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [selected, setSelected] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const { lat, lng } = place

  useEffect(() => {
    const controller = new AbortController()
    fetchSunsetForecast({ lat, lng }, controller.signal)
      .then((days) => setState({ status: 'ready', days }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [lat, lng, attempt])

  const retry = () => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }

  return (
    <main className="tonight">
      <PlaceHeader place={place} onUseGps={onUseGps} onOpenMap={onOpenMap} />
      {state.status === 'loading' && <p className="status">{t('loadingForecast')}</p>}
      {state.status === 'error' && (
        <div className="status">
          <p>{t('error')}</p>
          <button onClick={retry}>{t('retry')}</button>
        </div>
      )}
      {state.status === 'ready' && (
        <>
          <DayDetail day={state.days[selected]} />
          <WeekStrip days={state.days} selected={selected} onSelect={setSelected} />
        </>
      )}
    </main>
  )
}
