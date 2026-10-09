import { describe, expect, it } from 'vitest'
import { isDense, leadingBlanks } from './calendar'

describe('calendar layout', () => {
  it('puts the first day in its Sunday-first column', () => {
    expect(leadingBlanks(new Date(2026, 9, 4))).toBe(0) // Sunday
    expect(leadingBlanks(new Date(2026, 9, 9))).toBe(5) // Friday
  })
  it('drops day numbers beyond a month', () => {
    expect(isDense(30)).toBe(false)
    expect(isDense(90)).toBe(true)
  })
})
