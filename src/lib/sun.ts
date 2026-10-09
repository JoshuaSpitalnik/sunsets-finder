import { addTime, getPosition, getTimes } from 'suncalc'
import type { LatLng } from './geo'

export interface SunsetTimes {
  /** Start of golden hour (sun 6° above horizon) — time to be in position. */
  goldenHour: Date
  sunset: Date
  /** End of peak colour: sun 4° below the horizon, when clouds stop being lit from below. */
  peakColorEnd: Date
  /** Civil dusk (sun 6° below horizon) — end of blue hour / afterglow. */
  dusk: Date
  /** Compass bearing (0 = north, 270 = west) of the sun at sunset. */
  azimuth: number
}

// Clouds overhead keep catching sunlight until the sun is about 4° below the horizon.
addTime(-4, 'peakColorStartMorning', 'peakColorEnd')

/**
 * Sunset times for the device-local calendar day containing `date`.
 * `heightM` is the viewer's height above the surroundings — higher spots see the sun set later.
 */
export function getSunsetTimes(date: Date, at: LatLng, heightM = 0): SunsetTimes {
  const t = getTimes(date, at.lat, at.lng, heightM, -date.getTimezoneOffset())
  const peakColorEnd = t.peakColorEnd
  if (!t.sunset || !t.goldenHour || !t.dusk || !(peakColorEnd instanceof Date)) {
    throw new Error('No sunset at this latitude on this date')
  }
  return {
    goldenHour: t.goldenHour,
    sunset: t.sunset,
    peakColorEnd,
    dusk: t.dusk,
    azimuth: getPosition(t.sunset, at.lat, at.lng).azimuth,
  }
}
