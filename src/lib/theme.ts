import type { Label } from './score'

/** Label colours and tints from the design (score numbers, pins, calendar cells). */
export const LABEL_COLOR: Record<Label, string> = { meh: '#9C958B', nice: '#D9952F', great: '#E06A33', epic: '#C93F62' }
export const LABEL_TINT: Record<Label, string> = { meh: '#F0ECE6', nice: '#FBF0DC', great: '#FBE6DA', epic: '#F8E1E7' }
/** Calendar cells: "meh" gets a lighter fill with dark text so the colourful days stand out. */
export const CALENDAR_FILL: Record<Label, string> = { ...LABEL_COLOR, meh: '#E2DCD3' }

/** A saved spot scoring at least this is a "great evening" worth an alert. */
export const GREAT_EVENING_SCORE = 55
