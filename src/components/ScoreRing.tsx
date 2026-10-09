import { useTranslation } from 'react-i18next'
import type { Label } from '../lib/score'

interface Props {
  score: number
  label: Label
}

const R = 52
const CIRCUMFERENCE = 2 * Math.PI * R

export function ScoreRing({ score, label }: Props) {
  const { t } = useTranslation()
  return (
    <div className={`score-ring score-${label}`} role="img" aria-label={`${score}/100 — ${t(`labels.${label}`)}`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="score-track" cx="60" cy="60" r={R} />
        <circle
          className="score-value"
          cx="60"
          cy="60"
          r={R}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
        />
      </svg>
      <div className="score-text">
        <bdi className="score-number">{score}</bdi>
        <span className="score-label">{t(`labels.${label}`)}</span>
      </div>
    </div>
  )
}
