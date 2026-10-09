import { useTranslation } from 'react-i18next'
import type { Reason } from '../lib/score'

/** "Why": each scoring reason with a + or – badge. */
export function WhyList({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation()
  if (reasons.length === 0) return null
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
    </section>
  )
}
