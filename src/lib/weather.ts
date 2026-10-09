import { destination, type LatLng } from './geo'
import { getSunsetTimes, type SunsetTimes } from './sun'
import { confidenceFor, scoreSunset, type Confidence, type SunsetConditions, type SunsetScore } from './score'

/** Distances (km) toward the sunset at which we check for low cloud blocking the light. */
export const LIGHT_PATH_KM = [25, 50, 100, 200]
export const FORECAST_DAYS = 7

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const AIR_QUALITY_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const HOURLY_VARS = [
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'precipitation_probability',
  'precipitation',
  'visibility',
  'relative_humidity_2m',
] as const

export interface HourlySeries {
  time: number[] // unix seconds
  [variable: string]: (number | null)[]
}

export interface DayForecast {
  date: Date
  times: SunsetTimes
  conditions: SunsetConditions
  result: SunsetScore
  confidence: Confidence
}

function nearestIndex(times: number[], unixSeconds: number): number {
  let best = 0
  for (let i = 1; i < times.length; i++) {
    if (Math.abs(times[i] - unixSeconds) < Math.abs(times[best] - unixSeconds)) best = i
  }
  return best
}

const valueAt = (series: HourlySeries, key: string, i: number, fallback = 0) => series[key]?.[i] ?? fallback

/** Build the model inputs for one sunset from raw hourly series. Pure, so it is unit-testable. */
export function buildConditions(
  sunset: Date,
  viewer: HourlySeries,
  path: HourlySeries[],
  air?: HourlySeries,
): SunsetConditions {
  const t = Math.floor(sunset.getTime() / 1000)
  const i = nearestIndex(viewer.time, t)

  let rainBeforeMm = 0
  for (let k = Math.max(0, i - 6); k < i; k++) rainBeforeMm += valueAt(viewer, 'precipitation', k)

  let aod: number | undefined
  let dust: number | undefined
  if (air && air.time.length > 0) {
    const j = nearestIndex(air.time, t)
    // Only trust air quality data within an hour of sunset (its forecast horizon is shorter).
    if (Math.abs(air.time[j] - t) <= 3600) {
      aod = air.aerosol_optical_depth?.[j] ?? undefined
      dust = air.dust?.[j] ?? undefined
    }
  }

  return {
    highCloud: valueAt(viewer, 'cloud_cover_high', i),
    midCloud: valueAt(viewer, 'cloud_cover_mid', i),
    lowCloud: valueAt(viewer, 'cloud_cover_low', i),
    pathLowCloud: path.map((p) => valueAt(p, 'cloud_cover_low', nearestIndex(p.time, t))),
    precipProbability: valueAt(viewer, 'precipitation_probability', i),
    rainBeforeMm,
    visibilityM: valueAt(viewer, 'visibility', i, 20_000),
    humidity: valueAt(viewer, 'relative_humidity_2m', i, 60),
    aod,
    dust,
    month: sunset.getMonth() + 1,
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  return res.json()
}

/** Points on the light path, using today's sunset azimuth (it drifts < 1°/day). */
export function lightPathPoints(at: LatLng, azimuth: number): LatLng[] {
  return LIGHT_PATH_KM.map((km) => destination(at, azimuth, km))
}

export async function fetchSunsetForecast(at: LatLng, signal?: AbortSignal): Promise<DayForecast[]> {
  const today = new Date()
  const path = lightPathPoints(at, getSunsetTimes(today, at).azimuth)
  const points = [at, ...path]
  const coords = (p: LatLng[]) =>
    `latitude=${p.map((x) => x.lat.toFixed(4)).join(',')}&longitude=${p.map((x) => x.lng.toFixed(4)).join(',')}`

  const forecastUrl = `${FORECAST_URL}?${coords(points)}&hourly=${HOURLY_VARS.join(',')}&timeformat=unixtime&past_days=1&forecast_days=${FORECAST_DAYS}`
  const airUrl = `${AIR_QUALITY_URL}?${coords([at])}&hourly=aerosol_optical_depth,dust&timeformat=unixtime&forecast_days=5`

  const [forecastRaw, airRaw] = await Promise.all([
    getJson(forecastUrl, signal),
    // Air quality is a bonus signal — the forecast still works without it.
    getJson(airUrl, signal).catch(() => undefined),
  ])

  const forecasts = (Array.isArray(forecastRaw) ? forecastRaw : [forecastRaw]) as { hourly: HourlySeries }[]
  const [viewer, ...pathSeries] = forecasts.map((f) => f.hourly)
  const air = (airRaw as { hourly?: HourlySeries } | undefined)?.hourly

  return Array.from({ length: FORECAST_DAYS }, (_, d) => {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const times = getSunsetTimes(date, at)
    const conditions = buildConditions(times.sunset, viewer, pathSeries, air)
    return { date, times, conditions, result: scoreSunset(conditions), confidence: confidenceFor(d) }
  })
}
