import { useTranslation } from 'react-i18next'
import { SOURCE_LIST } from '../lib/osint/feed'
import type { Reliability } from '../lib/osint/types'

const LEVELS: Reliability[] = ['off', 'low', 'medium', 'high']

interface Props {
  reliabilityOf: (sourceId: string) => Reliability
  onChange: (sourceId: string, r: Reliability) => void
}

/** Per-source reliability: how much each one can move the sunset score. */
export function SourcesCard({ reliabilityOf, onChange }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'he' ? 'he' : 'en'
  return (
    <section className="card sources-card">
      <h2 className="card-title">{t('osint.sources')}</h2>
      <p className="fine-print">{t('osint.sourcesHint')}</p>
      <ul className="source-list">
        {SOURCE_LIST.map((s) => (
          <li key={s.id}>
            <span className="source-name">
              <a href={s.link} target="_blank" rel="noreferrer">
                {s.name[lang]}
              </a>
              <span className="muted-sm">{t(`osint.kind.${s.kind}`)}</span>
            </span>
            <div className="segmented segmented-small" role="group" aria-label={s.name[lang]}>
              {LEVELS.map((l) => (
                <button key={l} aria-pressed={reliabilityOf(s.id) === l} onClick={() => onChange(s.id, l)}>
                  {t(`osint.reliability.${l}`)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
