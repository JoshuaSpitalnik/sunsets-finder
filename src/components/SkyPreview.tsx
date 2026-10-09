import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { weightedPathBlockage, type SunsetConditions } from '../lib/score'

interface Props {
  conditions: SunsetConditions
  score: number
  /** Seed so the same day always draws the same clouds. */
  seed: number
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const mix = (a: number[], b: number[], t: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`

const W = 320
const H = 180
const HORIZON = 120

/**
 * An illustration of the sunset generated from the weather at sunset: cloud layers, how lit they
 * are (light path), dust haze and rain. It is a simulation, not a photo.
 */
export function SkyPreview({ conditions: c, score, seed }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const rand = rng(seed)

  const blockage = weightedPathBlockage(c.pathLowCloud)
  const lit = (1 - blockage / 100) ** 1.5 // how much sunlight reaches the clouds
  const glow = Math.min(1, score / 85)
  const heavyDust = (c.aod ?? 0) > 0.6 || (c.dust ?? 0) > 200

  const horizonColor = heavyDust
    ? mix([140, 130, 120], [214, 160, 92], glow * 0.6)
    : mix([120, 132, 150], [255, 112, 64], glow)
  const midSky = mix([70, 80, 110], [214, 86, 120], glow * 0.8)
  const litCloud = (strength: number) => mix([96, 96, 112], [255, 120, 110], lit * strength * glow)

  const highClouds = Array.from({ length: Math.round(c.highCloud / 8) }, () => ({
    x: rand() * W,
    y: 12 + rand() * 50,
    rx: 30 + rand() * 60,
    ry: 1.5 + rand() * 2.5,
  }))
  const midClouds = Array.from({ length: Math.round(c.midCloud / 10) }, () => ({
    x: rand() * W,
    y: 50 + rand() * 45,
    rx: 18 + rand() * 30,
    ry: 6 + rand() * 6,
  }))
  const lowOverhead = Array.from({ length: Math.round(c.lowCloud / 12) }, () => ({
    x: rand() * W,
    y: 85 + rand() * 25,
    rx: 25 + rand() * 35,
    ry: 9 + rand() * 7,
  }))
  const horizonBank = (blockage / 100) * 34
  const rain = c.precipProbability > 60

  return (
    <figure className="sky-preview">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('sky.alt')}>
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2440" />
            <stop offset="0.55" stopColor={midSky} />
            <stop offset="1" stopColor={horizonColor} />
          </linearGradient>
          <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={horizonColor} stopOpacity="0.55" />
            <stop offset="1" stopColor="#0f1626" />
          </linearGradient>
          <radialGradient id={`${id}-sun`}>
            <stop offset="0" stopColor={heavyDust ? '#f3d9a8' : '#fff1c4'} />
            <stop offset="1" stopColor={heavyDust ? '#d9a868' : '#ff8a3d'} />
          </radialGradient>
        </defs>

        <rect width={W} height={HORIZON} fill={`url(#${id}-sky)`} />
        {heavyDust && <rect width={W} height={HORIZON} fill="#c8a46a" opacity="0.35" />}

        <circle cx={W * 0.62} cy={HORIZON} r="13" fill={`url(#${id}-sun)`} opacity={0.25 + 0.75 * lit} />

        {highClouds.map((k, i) => (
          <ellipse key={`h${i}`} cx={k.x} cy={k.y} rx={k.rx} ry={k.ry} fill={litCloud(1)} opacity="0.75" />
        ))}
        {midClouds.map((k, i) => (
          <ellipse key={`m${i}`} cx={k.x} cy={k.y} rx={k.rx} ry={k.ry} fill={litCloud(0.85)} opacity="0.85" />
        ))}
        {horizonBank > 1 && (
          <rect x="0" y={HORIZON - horizonBank} width={W} height={horizonBank} fill="#3a3f52" opacity="0.92" />
        )}
        {lowOverhead.map((k, i) => (
          <ellipse key={`l${i}`} cx={k.x} cy={k.y} rx={k.rx} ry={k.ry} fill="#4a4e60" opacity="0.9" />
        ))}

        <rect y={HORIZON} width={W} height={H - HORIZON} fill={`url(#${id}-sea)`} />
        <rect x={W * 0.62 - 6} y={HORIZON + 2} width="12" height={H - HORIZON - 10} fill="#ffb070" opacity={0.35 * lit * glow} />

        {rain &&
          Array.from({ length: 40 }, (_, i) => {
            const x = rand() * W
            const y = rand() * H
            return <line key={`r${i}`} x1={x} y1={y} x2={x - 4} y2={y + 10} stroke="#b8c4d8" strokeOpacity="0.5" />
          })}
      </svg>
      <figcaption className="muted">{t('sky.caption')}</figcaption>
    </figure>
  )
}
