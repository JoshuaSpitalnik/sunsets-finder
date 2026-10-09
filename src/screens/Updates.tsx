import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AddPostCard } from '../components/AddPostCard'
import { PostCard } from '../components/PostCard'
import { SourcesCard } from '../components/SourcesCard'
import { useFormat } from '../i18n/useFormat'
import type { LatLng } from '../lib/geo'
import { analyzePost } from '../lib/osint/analyze'
import { sourceById } from '../lib/osint/feed'
import { regionOf } from '../lib/osint/region'
import type { Osint } from '../lib/osint/useOsint'
import { LABEL_COLOR } from '../lib/theme'
import type { DayForecast } from '../lib/weather'

interface Props {
  osint: Osint
  place: LatLng
  placeName: string
  /** Tonight's forecast at the place, with forecasters' nudge applied. */
  today?: DayForecast
  now: number
  /** Text shared into the app (Share → Sunset Finder), waiting to be filed. */
  shareDraft?: string
  onDraftDone: () => void
}

/** The scrollable feed of weather posts, what they say about tonight, and source settings. */
export function Updates({ osint, place, placeName, today, now, shareDraft, onDraftDone }: Props) {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const [adding, setAdding] = useState(false)
  const [onlyLeads, setOnlyLeads] = useState(true)
  const region = regionOf(place)
  const lang = i18n.language === 'he' ? 'he' : 'en'

  const withLeads = useMemo(
    () => new Set(osint.posts.filter((p) => analyzePost(p, region).leads.length > 0).map((p) => p.id)),
    [osint.posts, region],
  )
  const shown = onlyLeads ? osint.posts.filter((p) => withLeads.has(p.id)) : osint.posts
  const adj = today?.osint?.adjustment ?? 0
  const sourceName = (id: string) => sourceById(id)?.name[lang] ?? t('osint.other')

  return (
    <main className="page">
      <header className="page-head">
        <h1>{t('osint.title')}</h1>
        <p>{t('osint.sub')}</p>
      </header>

      <section className="card osint-summary">
        <div className="osint-summary-head">
          <span className="card-title">{t('osint.tonightAt', { place: placeName })}</span>
          {today?.osint && adj !== 0 && (
            <span className={adj > 0 ? 'delta delta-up' : 'delta delta-down'}>
              <bdi>{adj > 0 ? `+${adj}` : adj}</bdi>
            </span>
          )}
        </div>
        {today?.osint && today.modelScore !== undefined ? (
          <>
            <p className="osint-scoreline">
              <span className="muted-sm">{t('osint.modelOnly', { score: today.modelScore })}</span>
              <span aria-hidden="true" className="flip-rtl">
                →
              </span>
              <bdi className="osint-final" style={{ color: LABEL_COLOR[today.result.label] }}>
                {today.result.score} · {t(`labels.${today.result.label}`)}
              </bdi>
            </p>
            <ul className="why-list">
              {today.osint.leads.slice(0, 4).map((l) => (
                <li key={`${l.postId}|${l.cue}`}>
                  <span className={l.weight > 0 ? 'why-sign why-good' : 'why-sign why-bad'} aria-hidden="true">
                    {l.weight > 0 ? '+' : '–'}
                  </span>
                  <span>
                    {t(`cues.${l.cue}`)} <span className="muted-sm">· {sourceName(l.sourceId)} · {f.ago(l.publishedAt, now)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted-sm">{t('osint.noLeads')}</p>
        )}
      </section>

      {adding || shareDraft !== undefined ? (
        <AddPostCard
          initialText={shareDraft}
          onAdd={(p) => {
            osint.addShared(p)
            setAdding(false)
            setOnlyLeads(false)
            onDraftDone()
          }}
          onCancel={() => {
            setAdding(false)
            onDraftDone()
          }}
        />
      ) : (
        <button className="primary-button add-button" onClick={() => setAdding(true)}>
          + {t('osint.add')}
        </button>
      )}

      <div className="segmented segmented-2" role="group">
        <button aria-pressed={onlyLeads} onClick={() => setOnlyLeads(true)}>
          {t('osint.filterLeads')}
        </button>
        <button aria-pressed={!onlyLeads} onClick={() => setOnlyLeads(false)}>
          {t('osint.filterAll')}
        </button>
      </div>

      <p className="fine-print">
        {osint.status === 'error'
          ? t('osint.feedError')
          : osint.generatedAt
            ? t('osint.updated', { time: f.ago(osint.generatedAt, now) })
            : t('loading')}
      </p>

      {shown.length === 0 && osint.status !== 'loading' && <p className="status">{t('osint.empty')}</p>}
      {shown.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          region={region}
          now={now}
          reliability={osint.reliabilityOf(p.sourceId)}
          onRemove={p.shared ? () => osint.removeShared(p.id) : undefined}
        />
      ))}

      <SourcesCard reliabilityOf={osint.reliabilityOf} onChange={osint.setReliability} />
    </main>
  )
}
