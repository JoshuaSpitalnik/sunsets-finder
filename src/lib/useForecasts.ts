import { useEffect, useState } from 'react'
import type { LatLng } from './geo'
import { fetchSunsetForecast, type DayForecast } from './weather'

export type ForecastState = { status: 'loading' } | { status: 'ready'; days: DayForecast[] } | { status: 'error' }

export const pointKey = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`

/** 7-day forecast for one point. `attempt` lets the caller retry. */
export function useForecast(point: LatLng | undefined, attempt = 0): ForecastState {
  const [state, setState] = useState<{ key: string; value: ForecastState }>({ key: '', value: { status: 'loading' } })
  const key = point ? `${pointKey(point)}#${attempt}` : ''
  const lat = point?.lat
  const lng = point?.lng

  useEffect(() => {
    if (lat === undefined || lng === undefined) return
    const controller = new AbortController()
    fetchSunsetForecast({ lat, lng }, controller.signal)
      .then((days) => setState({ key, value: { status: 'ready', days } }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, value: { status: 'error' } })
      })
    return () => controller.abort()
  }, [key, lat, lng])

  // A new point shows "loading" until its own forecast arrives, never the previous point's.
  return state.key === key ? state.value : { status: 'loading' }
}

/** 7-day forecasts for many points (saved spots), keyed by `pointKey`. Fetched in parallel. */
export function useForecasts(points: LatLng[]): Record<string, ForecastState> {
  const [states, setStates] = useState<Record<string, ForecastState>>({})
  const keys = points.map(pointKey).join('|')

  useEffect(() => {
    const controller = new AbortController()
    for (const key of keys ? keys.split('|') : []) {
      const [lat, lng] = key.split(',').map(Number)
      fetchSunsetForecast({ lat, lng }, controller.signal)
        .then((days) => setStates((s) => ({ ...s, [key]: { status: 'ready', days } })))
        .catch(() => {
          if (!controller.signal.aborted) setStates((s) => ({ ...s, [key]: { status: 'error' } }))
        })
    }
    return () => controller.abort()
  }, [keys])

  return states
}

/** Current time, refreshed every 30 s so countdowns and evening mode stay live. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
