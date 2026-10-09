import { useTranslation } from 'react-i18next'
import type { Reason } from '../lib/score'

export function ReasonChips({ reasons }: { reasons: Reason[] }) {
  const { t } = useTranslation()
  return (
    <ul className="chips">
      {reasons.map((r) => (
        <li key={r.key} className={r.positive ? 'chip chip-good' : 'chip chip-bad'}>
          {r.positive ? '▲ ' : '▼ '}
          {t(`reasons.${r.key}`)}
        </li>
      ))}
    </ul>
  )
}
