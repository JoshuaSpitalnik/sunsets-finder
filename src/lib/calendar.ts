/** Empty cells before the first day so it lands in its weekday column (Sunday first, as in Israel). */
export const leadingBlanks = (first: Date) => first.getDay()

/** Ranges longer than a month hide the day numbers so the grid stays readable. */
export const isDense = (days: number) => days > 31
