import { addDays, isoDate } from '../weather'
import { analyzePost } from './analyze'
import type { Region } from './region'
import type { OsintPost } from './types'

/** Monthly archive files published next to the app by the scheduled job (osint-data branch). */
export const ARCHIVE_URL = 'https://joshuaspitalnik.github.io/sunsets-finder/osint-archive/'

export interface ArchiveIndex {
  updatedAt: string
  /** "YYYY-MM" → number of posts. */
  months: Record<string, number>
}

const monthCache = new Map<string, Promise<OsintPost[]>>()

export async function fetchArchiveIndex(signal?: AbortSignal): Promise<ArchiveIndex> {
  const res = await fetch(`${ARCHIVE_URL}index.json`, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Archive unavailable (${res.status})`)
  return (await res.json()) as ArchiveIndex
}

/** One month of posts; cached for the session (past months never change, the current one rarely). */
export function fetchArchiveMonth(month: string): Promise<OsintPost[]> {
  let p = monthCache.get(month)
  if (!p) {
    p = fetch(`${ARCHIVE_URL}${month}.json`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((j: { posts?: OsintPost[] }) => j.posts ?? [])
    p.catch(() => monthCache.delete(month))
    monthCache.set(month, p)
  }
  return p
}

/** "YYYY-MM" months touched by [from − 3 days, to]: posts from a few days before can be about the range. */
export function monthsFor(from: Date, to: Date): string[] {
  const out: string[] = []
  const d = new Date(addDays(from, -3).getFullYear(), addDays(from, -3).getMonth(), 1)
  while (d <= to) {
    out.push(isoDate(d).slice(0, 7))
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export interface SearchQuery {
  from: Date
  to: Date
  /** Free text: every word must appear (case-insensitive). */
  text: string
  /** Only posts with sunset clues. */
  onlyLeads: boolean
}

/**
 * Posts published in the range, or published shortly before and talking about a day in it
 * ("מחר ענני נוצה" posted the evening before). Newest first.
 */
export function searchPosts(posts: OsintPost[], q: SearchQuery, region: Region): OsintPost[] {
  const from = isoDate(q.from)
  const to = isoDate(q.to)
  const words = q.text.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const seen = new Set<string>()
  return posts
    .filter((p) => {
      if (seen.has(p.id)) return false
      seen.add(p.id)
      if (words.length && !words.every((w) => p.text.toLowerCase().includes(w))) return false
      const published = isoDate(new Date(p.publishedAt))
      const { leads } = analyzePost(p, region)
      const about = leads.some((l) => l.date >= from && l.date <= to)
      if (q.onlyLeads && !about && !(leads.length && published >= from && published <= to)) return false
      return (published >= from && published <= to) || about
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
}
