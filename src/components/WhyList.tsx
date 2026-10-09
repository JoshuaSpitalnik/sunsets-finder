import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { sourceById } from '../lib/osint/feed'
import type { DayOsint } from '../lib/osint/types'
import type { Reason } from '../lib/score'

interface Props {
  reasons: Reason[]
  /** Forecasters' leads for this day, and the weather-only score they moved. */
  osint?: DayOsint
  modelScore?: number
  now: number
  onOpenUpdates: () => void
}

/** "Why": each scoring reason with a + or – badge, then what forecasters said. */
export function WhyList({ reasons, osint, modelScore, now, onOpenUpdates }: Props) {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const lang = i18n.language === 'he' ? 'he' : 'en'
  if (reasons.length === 0 && !osint) return null

  return (
    <section className="card list-card">
      <h2 className="card-title list-title">{t('tonightScreen.why')}</h2>
      <ul className="why-list">
        {reasons.map((r) => (
          <li key={r.key}>
            <span className={r.positive ? 'why-sign why-good' : 'why-sign why-bad'} aria-hidden="true">
              {r.positive ? '+' : '–'}
            </span>
            {t(`reasons.${r.key}`)}
          </li>
        ))}
      </ul>
      {osint && (
        <>
          <div className="why-subhead">
            <span>{t('osint.why')}</span>
            {modelScore !== undefined && <span className="muted-sm">{t('osint.modelOnly', { score: modelScore })}</span>}
          </div>
          <ul className="why-list">
            {osint.leads.slice(0, 3).map((l) => (
              <li key={`${l.postId}|${l.cue}`}>
                <span className={l.weight > 0 ? 'why-sign why-good' : 'why-sign why-bad'} aria-hidden="true">
                  {l.weight > 0 ? '+' : '–'}
                </span>
                <span>
                  {t(`cues.${l.cue}`)}{' '}
                  <span className="muted-sm">
                    · {sourceById(l.sourceId)?.name[lang] ?? t('osint.other')} · {f.ago(l.publishedAt, now)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button className="text-link why-more" onClick={onOpenUpdates}>
            {t('osint.seeAll')}
          </button>
        </>
      )}
    </section>
  )
}
