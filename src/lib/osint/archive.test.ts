import { describe, expect, it } from 'vitest'
import { monthsFor, searchPosts } from './archive'
import type { OsintPost } from './types'

const post = (id: string, publishedAt: string, text: string): OsintPost => ({ id, sourceId: 'weather2day', publishedAt, text })

describe('monthsFor', () => {
  it('covers the range plus the few days before it', () => {
    expect(monthsFor(new Date(2026, 9, 2), new Date(2026, 9, 9))).toEqual(['2026-09', '2026-10'])
    expect(monthsFor(new Date(2025, 11, 20), new Date(2026, 1, 3))).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})

describe('searchPosts', () => {
  const posts = [
    post('a', '2026-10-05T06:30:00+03:00', 'היום ענני נוצה, שקיעה יפה.'),
    post('b', '2026-10-04T20:00:00+03:00', 'מחר בערב עננות גבוהה.'), // about Monday, posted Sunday
    post('c', '2026-10-05T09:00:00+03:00', 'עומס חום בערבה.'), // no sunset clue
    post('d', '2026-09-20T09:00:00+03:00', 'ענני נוצה'), // outside the range
  ]
  const monday = { from: new Date(2026, 9, 5), to: new Date(2026, 9, 5) }

  it('finds posts from the day and posts about it from the day before', () => {
    expect(searchPosts(posts, { ...monday, text: '', onlyLeads: true }, 'coast').map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('can include posts without clues, and matches every word', () => {
    expect(searchPosts(posts, { ...monday, text: '', onlyLeads: false }, 'coast').map((p) => p.id)).toEqual(['c', 'a', 'b'])
    expect(searchPosts(posts, { ...monday, text: 'ענני נוצה', onlyLeads: false }, 'coast').map((p) => p.id)).toEqual(['a'])
  })

  it('drops duplicates (a post both in the live feed and the archive)', () => {
    expect(searchPosts([...posts, posts[0]], { ...monday, text: 'שקיעה', onlyLeads: false }, 'coast')).toHaveLength(1)
  })
})
