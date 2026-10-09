import { Preferences } from '@capacitor/preferences'

/**
 * Small JSON store on top of Capacitor Preferences (native key-value storage in the apps,
 * localStorage in the PWA). Reads fall back to `fallback` when missing or unreadable.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key })
    return value === null ? fallback : (JSON.parse(value) as T)
  } catch {
    return fallback
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) })
  } catch {
    // Storage unavailable (private mode) — the change just won't persist.
  }
}

export interface Settings {
  remindGoldenHour: boolean
  alertGreatEvenings: boolean
}

/**
 * Off until the user turns them on: that tap is what asks for notification permission, so a toggle
 * never shows "on" while nothing can actually be delivered.
 */
export const DEFAULT_SETTINGS: Settings = { remindGoldenHour: false, alertGreatEvenings: false }

export const loadSettings = () => readJson<Settings>('settings', DEFAULT_SETTINGS)
export const saveSettings = (s: Settings) => writeJson('settings', s)
