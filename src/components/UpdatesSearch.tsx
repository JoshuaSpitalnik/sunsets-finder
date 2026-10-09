import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { fetchArchiveIndex, fetchArchiveMonth, monthsFor, searchPosts, type ArchiveIndex } from '../lib/osint/archive'
import { analyzePost } from '../lib/osint/analyze'
import { dayOsint } from '../lib/osint/combine'
import type { Region } from '../lib/osint/region'
import type { Lead, OsintPost } from '../lib/osint/types'
import type { Osint } from '../lib/osint/useOsint'
import { addDays, isoDate } from '../lib/weather'
import { PostCard } from './PostCard'

interface Props {
  osint: Osint
  region: Region
  now: number
  /** Open History on a day, to compare with its recorded-weather score. */
  onOpenHistory: (date: Date) => void
}

type Preset = 'yesterday' | 'week' | 'month' | 'custom'

/** One chip per clue, in order of first (strongest) appearance, with how many posts mentioned it. */
function byCue(leads: Lead[]) {
  const out = new Map<string, { cue: Lead['cue']; positive: boolean; count: number }>()
  for (const l of leads) {
    const c = out.get(l.cue)
    if (c) c.count++
    else out.set(l.cue, { cue: l.cue, positive: l.weight > 0, count: 1 })
  }
  return [...out.values()]
}
const PAGE = 30

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const parseInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Search past forecasters' posts by words and dates (archive + posts added on this device). */
export function UpdatesSearch({ osint, region, now, onOpenHistory }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  const [index, setIndex] = useState<ArchiveIndex | 'error' | undefined>()
  const [text, setText] = useState('')
  const [preset, setPreset] = useState<Preset>('week')
  const [range, setRange] = useState(() => {
    const to = startOfDay(new Date(now))
    return { from: addDays(to, -6), to }
  })
  const [onlyLeads, setOnlyLeads] = useState(true)
  const [pool, setPool] = useState<{ key: string; posts: OsintPost[] } | undefined>()
  const [shown, setShown] = useState(PAGE)
  const months = monthsFor(range.from, range.to)
  const monthsKey = months.join(',')

  useEffect(() => {
    const controller = new AbortController()
    fetchArchiveIndex(controller.signal)
      .then(setIndex)
      .catch(() => !controller.signal.aborted && setIndex('error'))
    return () => controller.abort()
  }, [])

  // Load the archive months the range needs.
  useEffect(() => {
    let cancelled = false
    Promise.all(monthsKey.split(',').map(fetchArchiveMonth))
      .then((lists) => !cancelled && setPool({ key: monthsKey, posts: lists.flat() }))
      .catch(() => !cancelled && setPool({ key: monthsKey, posts: [] }))
    return () => {
      cancelled = true
    }
  }, [monthsKey])

  const loading = pool?.key !== monthsKey
  const results = useMemo(
    () =>
      loading || !pool ? [] : searchPosts([...osint.posts, ...pool.posts], { ...range, text, onlyLeads }, region),
    [loading, pool, osint.posts, range, text, onlyLeads, region],
  )

  const singleDay = isoDate(range.from) === isoDate(range.to)
  const verdict = useMemo(() => {
    if (!singleDay) return undefined
    const leads = results.flatMap((p) => analyzePost(p, region).leads)
    // Judge as of the end of that day, so freshness is relative to the day itself and posts written
    // that evening ("the sunset was so red tonight") still count.
    const endOfDay = new Date(range.from)
    endOfDay.setHours(23, 59, 0, 0)
    return dayOsint(leads, isoDate(range.from), osint.reliabilityOf, +endOfDay)
  }, [singleDay, results, region, range.from, osint.reliabilityOf])

  const pick = (p: Preset) => {
    const today = startOfDay(new Date(now))
    setPreset(p)
    setShown(PAGE)
    if (p === 'yesterday') setRange({ from: addDays(today, -1), to: addDays(today, -1) })
    if (p === 'week') setRange({ from: addDays(today, -6), to: today })
    if (p === 'month') setRange({ from: addDays(today, -29), to: today })
  }
  const firstMonth = index && index !== 'error' ? Object.keys(index.months).sort()[0] : undefined
  const minDate = firstMonth ? `${firstMonth}-01` : undefined
  const maxDate = isoDate(new Date(now))

  return (
    <>
      <section className="card search-card">
        <input
          type="search"
          className="search-input"
          dir="auto"
          value={text}
          placeholder={t('osint.search.placeholder')}
          aria-label={t('osint.search.placeholder')}
          onChange={(e) => {
            setText(e.target.value)
            setShown(PAGE)
          }}
        />
        <div className="preset-chips">
          {(['yesterday', 'week', 'month', 'custom'] as Preset[]).map((p) => (
            <button key={p} className="preset-chip" aria-pressed={preset === p} onClick={() => (p === 'custom' ? setPreset('custom') : pick(p))}>
              {t(`osint.search.${p}`)}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="field-row">
            <label className="field">
              <span>{t('history.from')}</span>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={isoDate(range.from)}
                onChange={(e) => {
                  if (!e.target.value) return
                  const from = parseInput(e.target.value)
                  setRange((r) => ({ from, to: r.to < from ? from : r.to }))
                }}
              />
            </label>
            <label className="field">
              <span>{t('history.to')}</span>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={isoDate(range.to)}
                onChange={(e) => {
                  if (!e.target.value) return
                  const to = parseInput(e.target.value)
                  setRange((r) => ({ from: r.from > to ? to : r.from, to }))
                }}
              />
            </label>
          </div>
        )}
        <label className="check-row">
          <input type="checkbox" checked={onlyLeads} onChange={(e) => setOnlyLeads(e.target.checked)} />
          {t('osint.filterLeads')}
        </label>
        <p className="fine-print">
          {index === 'error'
            ? t('osint.search.archiveError')
            : firstMonth
              ? t('osint.search.since', { date: f.monthDay(parseInput(`${firstMonth}-01`)) + ` ${firstMonth.slice(0, 4)}` })
              : ''}
        </p>
      </section>

      {verdict && !loading && (
        <section className="card osint-summary">
          <div className="osint-summary-head">
            <span className="card-title">{t('osint.search.dayVerdict', { date: f.full(range.from) })}</span>
            {verdict.adjustment !== 0 && (
              <span className={verdict.adjustment > 0 ? 'delta delta-up' : 'delta delta-down'}>
                <bdi>{verdict.adjustment > 0 ? `+${verdict.adjustment}` : verdict.adjustment}</bdi>
              </span>
            )}
          </div>
          {verdict.leads.length === 0 ? (
            <p className="muted-sm">{t('osint.search.noClues')}</p>
          ) : (
            <ul className="lead-chips">
              {byCue(verdict.leads).map(({ cue, positive, count }) => (
                <li key={cue} className={positive ? 'lead-chip lead-good' : 'lead-chip lead-bad'}>
                  <span aria-hidden="true">{positive ? '▲' : '▼'}</span> {t(`cues.${cue}`)}
                  {count > 1 && <span className="lead-note"> ×{count}</span>}
                </li>
              ))}
            </ul>
          )}
          {range.from < startOfDay(new Date(now)) && (
            <button className="chip-button" onClick={() => onOpenHistory(range.from)}>
              {t('osint.search.actual')}
            </button>
          )}
        </section>
      )}

      <p className="fine-print">
        {loading
          ? t('osint.search.searching')
          : t('osint.search.results', { n: results.length, from: f.monthDay(range.from), to: f.monthDay(range.to) })}
      </p>
      {!loading && results.length === 0 && <p className="status">{t('osint.search.none')}</p>}
      {results.slice(0, shown).map((p) => (
        <PostCard
          key={p.id}
          post={p}
          region={region}
          now={now}
          reliability={osint.reliabilityOf(p.sourceId)}
          onRemove={p.shared ? () => osint.removeShared(p.id) : undefined}
        />
      ))}
      {results.length > shown && (
        <button className="chip-button show-more" onClick={() => setShown(shown + PAGE)}>
          {t('osint.search.more', { n: results.length - shown })}
        </button>
      )}
    </>
  )
}
