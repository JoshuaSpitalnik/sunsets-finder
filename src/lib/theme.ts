import type { Label } from './score'

/**
 * Label colours as CSS variables (defined in index.css for light and dark mode), so inline styles
 * — score numbers, pins, calendar cells — follow the system appearance.
 */
export const LABEL_COLOR: Record<Label, string> = {
  meh: 'var(--score-meh)',
  nice: 'var(--score-nice)',
  great: 'var(--score-great)',
  epic: 'var(--score-epic)',
}
export const LABEL_TINT: Record<Label, string> = {
  meh: 'var(--tint-meh)',
  nice: 'var(--tint-nice)',
  great: 'var(--tint-great)',
  epic: 'var(--tint-epic)',
}
/** Calendar cells: "meh" gets a neutral fill with secondary text so the colourful days stand out. */
export const CALENDAR_FILL: Record<Label, string> = { ...LABEL_COLOR, meh: 'var(--calendar-meh)' }

/** A saved spot scoring at least this is a "great evening" worth an alert. */
export const GREAT_EVENING_SCORE = 55
