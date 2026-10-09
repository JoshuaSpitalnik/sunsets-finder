import { getPosition, getTimes } from 'suncalc'
import type { LatLng } from './geo'

export interface SunsetTimes {
  /** Start of golden hour (sun 6° above horizon) — time to be in position. */
  goldenHour: Date
  sunset: Date
  /** End of the usual peak-colour window for clouds lit from below. */
  peakColorEnd: Date
  /** Civil dusk (sun 6° below horizon) — end of blue hour / afterglow. */
  dusk: Date
  /** Compass bearing (0 = north, 270 = west) of the sun at sunset. */
  azimuth: number
}

const PEAK_COLOR_MINUTES = 20

/**
 * Sunset times for the device-local calendar day containing `date`.
 * `heightM` is the viewer's height above the surroundings — higher spots see the sun set later.
 */
export function getSunsetTimes(date: Date, at: LatLng, heightM = 0): SunsetTimes {
  const t = getTimes(date, at.lat, at.lng, heightM, -date.getTimezoneOffset())
  if (!t.sunset || !t.goldenHour || !t.dusk) {
    throw new Error('No sunset at this latitude on this date')
  }
  return {
    goldenHour: t.goldenHour,
    sunset: t.sunset,
    peakColorEnd: new Date(t.sunset.getTime() + PEAK_COLOR_MINUTES * 60_000),
    dusk: t.dusk,
    azimuth: getPosition(t.sunset, at.lat, at.lng).azimuth,
  }
}
