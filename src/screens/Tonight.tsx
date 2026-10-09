import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DayChips } from '../components/DayChips'
import { EveningMode } from '../components/EveningMode'
import { IconBell, IconChevronDown, IconLocate } from '../components/Icons'
import { LightCard } from '../components/LightCard'
import { RemindersCard } from '../components/RemindersCard'
import { SkyHero } from '../components/SkyHero'
import { WhyList } from '../components/WhyList'
import { useFormat } from '../i18n/useFormat'
import type { Place } from '../lib/location'
import type { Settings } from '../lib/prefs'
import { minutesUntil, phaseAt } from '../lib/timeline'
import type { ForecastState } from '../lib/useForecasts'
import type { DayForecast } from '../lib/weather'

/** Arrive this long before golden hour starts. */
const ARRIVE_BEFORE_MIN = 10

interface Props {
  place: Place
  placeName: string
  forecast: ForecastState
  now: number
  settings: Settings
  notificationsBlocked: boolean
  onSettings: (s: Settings) => void
  onOpenMap: () => void
  onUseGps: () => void
  onRetry: () => void
  /** Live evening window (golden hour → end of blue hour) and not dismissed. */
  evening: boolean
  onDismissEvening: () => void
  onLanguage: () => void
  onOpenUpdates: () => void
}

export function Tonight(props: Props) {
  const { t } = useTranslation()
  const { forecast, now } = props
  const [selected, setSelected] = useState(0)

  if (forecast.status === 'loading') return <p className="status">{t('loading')}</p>
  if (forecast.status === 'error') {
    return (
      <div className="status">
        <p>{t('error')}</p>
        <button className="chip-button" onClick={props.onRetry}>
          {t('retry')}
        </button>
      </div>
    )
  }

  if (props.evening) {
    return <EveningMode day={forecast.days[0]} placeName={props.placeName} now={now} onExit={props.onDismissEvening} />
  }
  return <TonightForecast {...props} days={forecast.days} selected={selected} onSelect={setSelected} />
}

function TonightForecast({
  place,
  placeName,
  days,
  selected,
  onSelect,
  now,
  settings,
  notificationsBlocked,
  onSettings,
  onOpenMap,
  onUseGps,
  onLanguage,
  onOpenUpdates,
}: Props & { days: DayForecast[]; selected: number; onSelect: (i: number) => void }) {
  const { t } = useTranslation()
  const f = useFormat()
  const remindersRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  const day = days[selected]
  const tm = day.times
  const coords = `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`

  let countdown: string
  if (selected > 0) countdown = t('tonightScreen.otherDay', { day: f.weekdayLong(day.date), time: f.time(tm.sunset) })
  else {
    const phase = phaseAt(tm, now)
    if (phase === 'before') countdown = t('tonightScreen.goldenIn', { d: f.duration(minutesUntil(tm.goldenHour, now)) })
    else if (phase === 'golden') countdown = t('tonightScreen.sunsetIn', { d: f.duration(minutesUntil(tm.sunset, now)) })
    else if (phase === 'over') countdown = t('tonightScreen.over')
    else countdown = t('tonightScreen.peakNow')
  }

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(coords)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the coordinates stay visible and selectable.
    }
  }

  const header = (
    <div className="sky-header">
      <div className="sky-place">
        <button className="place-button" onClick={onOpenMap} aria-label={`${placeName}. ${t('place.openMap')}`}>
          <IconLocate size={14} />
          <span>{placeName}</span>
          <IconChevronDown />
        </button>
        <span className="sky-dateline">
          {place.source === 'gps' ? `${t('place.current')} · ` : ''}
          {f.full(new Date(now))}
        </span>
        <span className="sky-coords">
          <bdi dir="ltr">{coords}</bdi>
          {place.source === 'gps' && place.accuracyM !== undefined && <bdi>{t('place.accuracy', { m: place.accuracyM })}</bdi>}
          <button className="sky-link" onClick={copyCoords}>
            {copied ? t('place.copied') : t('place.copy')}
          </button>
          {place.source !== 'gps' && (
            <button className="sky-link" onClick={onUseGps}>
              {t('place.backToGps')}
            </button>
          )}
        </span>
        {place.source === 'fallback' && <span className="sky-coords">{t('place.fallbackNote')}</span>}
      </div>
      <button
        className="glass-round"
        aria-label={t('tonightScreen.remindersLabel')}
        onClick={() => remindersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      >
        <IconBell />
      </button>
    </div>
  )

  return (
    <main className="tonight">
      <SkyHero
        day={day}
        header={header}
        heading={`${placeName} · ${selected === 0 ? t('tonight') : f.weekdayLong(day.date)}`}
      />
      <div className="sheet">
        <span className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <span className="sheet-title">
            {t('tonightScreen.beThereBy', { time: f.time(new Date(+tm.goldenHour - ARRIVE_BEFORE_MIN * 60_000)) })}
          </span>
          <span className="accent-text">{countdown}</span>
        </div>
        <DayChips days={days} selected={selected} onSelect={onSelect} />
        {selected > 3 && <p className="fine-print">{t('tonightScreen.lessCertain')}</p>}
        {selected > 0 && (
          <button className="chip-button back-today" onClick={() => onSelect(0)}>
            <span className="flip-rtl" aria-hidden="true">
              ←
            </span>{' '}
            {t('tonightScreen.backToTonight')}
          </button>
        )}
        <LightCard times={tm} now={now} isToday={selected === 0} onMap={onOpenMap} />
        <WhyList
          reasons={day.result.reasons}
          osint={day.osint}
          modelScore={day.modelScore}
          now={now}
          onOpenUpdates={onOpenUpdates}
        />
        <RemindersCard
          ref={remindersRef}
          settings={settings}
          onChange={onSettings}
          goldenHour={days[0].times.goldenHour}
          blocked={notificationsBlocked}
        />
        <p className="footer-line">
          {t('footer')} ·{' '}
          <button className="text-link" onClick={onLanguage}>
            {t('language')}
          </button>
        </p>
      </div>
    </main>
  )
}
