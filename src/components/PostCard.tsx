import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { analyzePost } from '../lib/osint/analyze'
import { sourceById } from '../lib/osint/feed'
import type { Region } from '../lib/osint/region'
import type { Lead, OsintPost, Reliability } from '../lib/osint/types'

interface Props {
  post: OsintPost
  region: Region
  now: number
  reliability: Reliability
  onRemove?: () => void
}

const LONG_POST = 320
/** Older than this, show the date instead of "280 days ago". */
const OLD_MS = 6 * 86_400_000

/** Days this post has clues about, one chip per day+clue: "שני · ענני נוצה ▲". */
function leadChips(leads: Lead[]) {
  return [...leads].sort((a, b) => a.date.localeCompare(b.date) || Math.abs(b.weight) - Math.abs(a.weight))
}

/** One update in the feed, with the sunset clues highlighted. */
export function PostCard({ post, region, now, reliability, onRemove }: Props) {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const [expanded, setExpanded] = useState(false)
  const { leads, marks } = useMemo(() => analyzePost(post, region), [post, region])
  const source = sourceById(post.sourceId)
  const name = source ? source.name[i18n.language === 'he' ? 'he' : 'en'] : t('osint.other')
  const long = post.text.length > LONG_POST
  const shown = long && !expanded ? post.text.slice(0, LONG_POST) : post.text

  // Split the visible text into plain runs and highlighted clue words.
  const parts: React.ReactNode[] = []
  let at = 0
  for (const m of marks) {
    if (m.start >= shown.length) break
    if (m.start > at) parts.push(shown.slice(at, m.start))
    parts.push(
      <mark key={m.start} className={m.positive ? 'clue clue-good' : 'clue clue-bad'}>
        {shown.slice(m.start, Math.min(m.end, shown.length))}
      </mark>,
    )
    at = Math.min(m.end, shown.length)
  }
  if (at < shown.length) parts.push(shown.slice(at))
  if (long && !expanded) parts.push('…')

  const dayName = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return f.weekdayShort(new Date(y, m - 1, d))
  }

  return (
    <article className="card post">
      <header className="post-head">
        <span className="post-avatar" aria-hidden="true">
          {name.slice(0, 1)}
        </span>
        <span className="post-who">
          <span className="post-source">{name}</span>
          <span className="muted-sm">
            {source && t(`osint.kind.${source.kind}`)}
            {post.shared && ` · ${t('osint.shared')}`} ·{' '}
            {now - Date.parse(post.publishedAt) > OLD_MS
              ? `${f.full(new Date(post.publishedAt))}, ${f.time(new Date(post.publishedAt))}`
              : f.ago(post.publishedAt, now)}
          </span>
        </span>
        <span className={`reliability reliability-${reliability}`}>{t(`osint.reliability.${reliability}`)}</span>
      </header>

      {post.forDate && <span className="post-for">{t('osint.aboutDay', { day: f.full(new Date(`${post.forDate}T12:00:00`)) })}</span>}
      <p className="post-text">{parts}</p>
      {long && (
        <button className="text-link post-more" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('osint.less') : t('osint.more')}
        </button>
      )}

      {leads.length > 0 && (
        <ul className="lead-chips">
          {leadChips(leads).map((l) => (
            <li key={`${l.date}|${l.cue}`} className={l.weight > 0 ? 'lead-chip lead-good' : 'lead-chip lead-bad'}>
              <span aria-hidden="true">{l.weight > 0 ? '▲' : '▼'}</span> {dayName(l.date)} · {t(`cues.${l.cue}`)}
              {l.hedged && <span className="lead-note"> · {t('osint.hedged')}</span>}
              {l.otherRegion && <span className="lead-note"> · {t('osint.otherRegion')}</span>}
            </li>
          ))}
        </ul>
      )}

      <footer className="post-foot">
        {post.url && (
          <a className="text-link" href={post.url} target="_blank" rel="noreferrer">
            {t('osint.open')}
          </a>
        )}
        {onRemove && (
          <button className="text-link muted-link" onClick={onRemove}>
            {t('osint.remove')}
          </button>
        )}
      </footer>
    </article>
  )
}
