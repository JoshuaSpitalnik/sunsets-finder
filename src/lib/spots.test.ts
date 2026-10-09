import { describe, expect, it } from 'vitest'
import { SEED_SPOTS, sameSpot, spotLabel, toggleSpot } from './spots'

describe('spots', () => {
  it('toggles a spot in and out by position', () => {
    const pin = { lat: 32.0546, lng: 34.75051, name: 'Somewhere' }
    expect(SEED_SPOTS.some((s) => sameSpot(s, pin))).toBe(true)
    const removed = toggleSpot(SEED_SPOTS, pin)
    expect(removed).toHaveLength(SEED_SPOTS.length - 1)
    expect(toggleSpot(removed, pin)).toHaveLength(SEED_SPOTS.length)
  })

  it('translates seed spots into Hebrew only', () => {
    expect(spotLabel(SEED_SPOTS[1], 'he').name).toBe('נמל יפו')
    expect(spotLabel(SEED_SPOTS[1], 'en').name).toBe('Jaffa Port')
    expect(spotLabel({ lat: 1, lng: 1, name: 'My cliff' }, 'he').name).toBe('My cliff')
  })
})
