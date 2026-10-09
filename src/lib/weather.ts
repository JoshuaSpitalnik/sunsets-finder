import { destination, type LatLng } from './geo'
import { getSunsetTimes, type SunsetTimes } from './sun'
import { confidenceFor, scoreSunset, type Confidence, type SunsetConditions, type SunsetScore } from './score'

/** Distances (km) toward the sunset at which we check for low cloud blocking the light. */
export const LIGHT_PATH_KM = [25, 50, 100, 200]
export const FORECAST_DAYS = 7
/** Longest range the history search will fetch in one go. */
export const MAX_HISTORY_DAYS = 92
/** Earliest date with hourly cloud layers in Open-Meteo's historical forecast archive. */
export const HISTORY_START = new Date(2022, 0, 1)

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
const HISTORICAL_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast'
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
  /** Only for forecasts — past days are scored from what actually happened. */
  confidence?: Confidence
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
  let res: Response
  try {
    res = await fetch(url, { signal })
  } catch (err) {
    // One retry for flaky mobile connections; never retry a cancelled request.
    if (signal?.aborted) throw err
    await new Promise((r) => setTimeout(r, 1000))
    res = await fetch(url, { signal })
  }
  if (!res.ok) throw new Error(`Weather request failed (${res.status})`)
  return res.json()
}

/** Points on the light path for a given sunset azimuth. */
export function lightPathPoints(at: LatLng, azimuth: number): LatLng[] {
  return LIGHT_PATH_KM.map((km) => destination(at, azimuth, km))
}

/** Local calendar date as YYYY-MM-DD (the API's date format). */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

const coordsParam = (p: LatLng[]) =>
  `latitude=${p.map((x) => x.lat.toFixed(4)).join(',')}&longitude=${p.map((x) => x.lng.toFixed(4)).join(',')}`

async function scoreDates(
  at: LatLng,
  dates: Date[],
  weatherUrl: (points: LatLng[]) => string,
  airUrl: string,
  signal?: AbortSignal,
): Promise<{ date: Date; times: SunsetTimes; conditions: SunsetConditions; result: SunsetScore }[]> {
  // The sunset azimuth drifts < 1°/day, so the mid-range azimuth is accurate enough for every day.
  const mid = dates[Math.floor(dates.length / 2)]
  const points = [at, ...lightPathPoints(at, getSunsetTimes(mid, at).azimuth)]

  const [weatherRaw, airRaw] = await Promise.all([
    getJson(weatherUrl(points), signal),
    // Air quality is a bonus signal — scoring still works without it.
    getJson(airUrl, signal).catch(() => undefined),
  ])

  const series = (Array.isArray(weatherRaw) ? weatherRaw : [weatherRaw]) as { hourly: HourlySeries }[]
  const [viewer, ...pathSeries] = series.map((f) => f.hourly)
  const air = (airRaw as { hourly?: HourlySeries } | undefined)?.hourly

  return dates.map((date) => {
    const times = getSunsetTimes(date, at)
    const conditions = buildConditions(times.sunset, viewer, pathSeries, air)
    return { date, times, conditions, result: scoreSunset(conditions) }
  })
}

export async function fetchSunsetForecast(at: LatLng, signal?: AbortSignal): Promise<DayForecast[]> {
  const today = new Date()
  const dates = Array.from({ length: FORECAST_DAYS }, (_, d) => addDays(today, d))
  const days = await scoreDates(
    at,
    dates,
    (points) =>
      `${FORECAST_URL}?${coordsParam(points)}&hourly=${HOURLY_VARS.join(',')}&timeformat=unixtime&past_days=1&forecast_days=${FORECAST_DAYS}`,
    `${AIR_QUALITY_URL}?${coordsParam([at])}&hourly=aerosol_optical_depth,dust&timeformat=unixtime&forecast_days=5`,
    signal,
  )
  return days.map((d, i) => ({ ...d, confidence: confidenceFor(i) }))
}

/** Score past sunsets from archived weather, for every day in [from, to] (inclusive). */
export async function fetchSunsetHistory(at: LatLng, from: Date, to: Date, signal?: AbortSignal): Promise<DayForecast[]> {
  const dates: Date[] = []
  for (let d = new Date(from); d <= to && dates.length < MAX_HISTORY_DAYS; d = addDays(d, 1)) dates.push(new Date(d))
  if (dates.length === 0) return []
  const last = dates[dates.length - 1]
  // Start a day early so "rain in the 6 hours before sunset" is always covered.
  const range = `start_date=${isoDate(addDays(dates[0], -1))}&end_date=${isoDate(last)}`
  return scoreDates(
    at,
    dates,
    (points) => `${HISTORICAL_URL}?${coordsParam(points)}&hourly=${HOURLY_VARS.join(',')}&timeformat=unixtime&${range}`,
    `${AIR_QUALITY_URL}?${coordsParam([at])}&hourly=aerosol_optical_depth,dust&timeformat=unixtime&${range}`,
    signal,
  )
}
