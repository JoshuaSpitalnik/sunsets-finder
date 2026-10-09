import { readJson, writeJson } from '../prefs'
import SOURCES from './sources.json'
import type { OsintPost, Reliability } from './types'

export interface Source {
  id: string
  kind: 'official' | 'forecaster' | 'community' | 'news'
  name: { he: string; en: string }
  fetch: { type: string }
  link: string
  /** Text that identifies a shared post as coming from this source (channel links, names). */
  match?: string[]
  reliability: Reliability
}

export const SOURCE_LIST = SOURCES as Source[]
export const sourceById = (id: string) => SOURCE_LIST.find((s) => s.id === id)
/** Posts pasted from a source that isn't in the list. */
export const OTHER_SOURCE = 'other'

/**
 * The scheduled GitHub Action publishes this next to the app. Absolute, so the Android/iOS apps
 * (which don't run from GitHub Pages) read the same file; GitHub Pages allows cross-origin reads.
 */
export const FEED_URL = 'https://joshuaspitalnik.github.io/sunsets-finder/osint.json'

export interface Feed {
  generatedAt?: string
  posts: OsintPost[]
}

export async function fetchFeed(signal?: AbortSignal): Promise<Feed> {
  const res = await fetch(FEED_URL, { signal, cache: 'no-cache' })
  if (!res.ok) throw new Error(`Feed unavailable (${res.status})`)
  const json = (await res.json()) as Feed
  return { generatedAt: json.generatedAt, posts: Array.isArray(json.posts) ? json.posts : [] }
}

/** Guess a shared post's source from links or names in it (WhatsApp shares carry the channel link). */
export function detectSource(text: string): string | undefined {
  const lower = text.toLowerCase()
  return SOURCE_LIST.find((s) => s.match?.some((m) => lower.includes(m.toLowerCase())))?.id
}

const SHARED_KEY = 'osint.shared'
const RELIABILITY_KEY = 'osint.reliability'
/** Shared posts older than this are dropped. */
const KEEP_SHARED_DAYS = 30

export async function loadShared(): Promise<OsintPost[]> {
  const posts = await readJson<OsintPost[]>(SHARED_KEY, [])
  const cutoff = Date.now() - KEEP_SHARED_DAYS * 86_400_000
  return posts.filter((p) => Date.parse(p.publishedAt) >= cutoff)
}
export const saveShared = (posts: OsintPost[]) => writeJson(SHARED_KEY, posts)

export const loadReliability = () => readJson<Record<string, Reliability>>(RELIABILITY_KEY, {})
export const saveReliability = (r: Record<string, Reliability>) => writeJson(RELIABILITY_KEY, r)

/** The user's choice for a source, else its default. Unknown ("other") sources count as low. */
export const reliabilityFor = (overrides: Record<string, Reliability>, sourceId: string): Reliability =>
  overrides[sourceId] ?? sourceById(sourceId)?.reliability ?? 'low'
