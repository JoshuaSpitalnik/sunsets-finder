import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LatLng } from '../geo'
import type { DayForecast } from '../weather'
import { analyzePost } from './analyze'
import { applyOsint } from './combine'
import {
  fetchFeed,
  loadReliability,
  loadShared,
  reliabilityFor,
  saveReliability,
  saveShared,
  type Feed,
} from './feed'
import { regionOf, type Region } from './region'
import type { Lead, OsintPost, Reliability } from './types'

const REGIONS: Region[] = ['north', 'coast', 'mountains', 'south']

/** Re-read the feed this often while the app is open (the job refreshes it every 30 min). */
const REFRESH_MS = 10 * 60_000

export type FeedStatus = 'loading' | 'ready' | 'error'

export interface Osint {
  posts: OsintPost[]
  status: FeedStatus
  generatedAt?: string
  reliabilityOf: (sourceId: string) => Reliability
  setReliability: (sourceId: string, r: Reliability) => void
  addShared: (post: OsintPost) => void
  removeShared: (id: string) => void
  /** Apply forecasters' leads (for that point's region) to a forecast. */
  adjust: (days: DayForecast[], at: LatLng) => DayForecast[]
}

/** Feed + shared posts, the user's source reliabilities, and the score adjustment built from them. */
export function useOsint(now: number): Osint {
  const [feed, setFeed] = useState<Feed>({ posts: [] })
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [shared, setShared] = useState<OsintPost[]>([])
  const [overrides, setOverrides] = useState<Record<string, Reliability>>({})

  useEffect(() => {
    void loadShared().then(setShared)
    void loadReliability().then(setOverrides)
  }, [])

  useEffect(() => {
    let controller = new AbortController()
    const load = () => {
      controller.abort()
      controller = new AbortController()
      fetchFeed(controller.signal)
        .then((f) => {
          setFeed(f)
          setStatus('ready')
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus((s) => (s === 'ready' ? s : 'error'))
        })
    }
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      clearInterval(id)
      controller.abort()
    }
  }, [])

  const posts = useMemo(
    () => [...shared, ...feed.posts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    [shared, feed.posts],
  )
  const reliabilityOf = useCallback((id: string) => reliabilityFor(overrides, id), [overrides])

  // Leads depend on the region (a post about the north counts less on the coast); ~50 posts × 4 regions is cheap.
  const leadsByRegion = useMemo(() => {
    const all = {} as Record<Region, Lead[]>
    for (const r of REGIONS) all[r] = posts.flatMap((p) => analyzePost(p, r).leads)
    return all
  }, [posts])

  const adjust = useCallback(
    (days: DayForecast[], at: LatLng) => applyOsint(days, leadsByRegion[regionOf(at)], reliabilityOf, now),
    [leadsByRegion, reliabilityOf, now],
  )

  return {
    posts,
    status,
    generatedAt: feed.generatedAt,
    reliabilityOf,
    setReliability: (sourceId, r) => {
      const next = { ...overrides, [sourceId]: r }
      setOverrides(next)
      void saveReliability(next)
    },
    addShared: (post) => {
      const next = [post, ...shared.filter((p) => p.id !== post.id)]
      setShared(next)
      void saveShared(next)
    },
    removeShared: (id) => {
      const next = shared.filter((p) => p.id !== id)
      setShared(next)
      void saveShared(next)
    },
    adjust,
  }
}
