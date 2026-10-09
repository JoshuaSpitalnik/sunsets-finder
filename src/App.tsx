import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TabBar, type Tab } from './components/TabBar'
import { useFormat } from './i18n/useFormat'
import type { LatLng } from './lib/geo'
import { getUserLocation, reverseGeocode, type Place } from './lib/location'
import { ensurePermission, planNotifications, reschedule } from './lib/notifications'
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './lib/prefs'
import { loadSpots, sameSpot, saveSpots, spotLabel, toggleSpot, type Spot } from './lib/spots'
import { isEvening } from './lib/timeline'
import { pointKey, useForecast, useForecasts, useNow } from './lib/useForecasts'
import { useOsint } from './lib/osint/useOsint'
import type { ForecastState } from './lib/useForecasts'
import { History } from './screens/History'
import { Updates } from './screens/Updates'
import { Spots } from './screens/Spots'
import { Tonight } from './screens/Tonight'

// MapLibre is large — only load it when the map tab is opened.
const MapScreen = lazy(() => import('./screens/MapScreen'))

/** Text shared into the app via the PWA share target (?share_title / share_text / share_url). */
function readShare(): string | undefined {
  const q = new URLSearchParams(window.location.search)
  const text = [q.get('share_title'), q.get('share_text'), q.get('share_url')].filter(Boolean).join('\n').trim()
  return text || undefined
}

export default function App() {
  const { t, i18n } = useTranslation()
  const f = useFormat()
  const now = useNow()
  const [place, setPlace] = useState<Place | undefined>()
  const [tab, setTab] = useState<Tab>(() => (readShare() ? 'updates' : 'tonight'))
  const [mapPin, setMapPin] = useState<{ pin: Place; n: number } | undefined>()
  const [history, setHistory] = useState<{ place: Place; focus?: Date } | undefined>()
  const [spots, setSpots] = useState<Spot[]>([])
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [blocked, setBlocked] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [eveningDismissedFor, setEveningDismissedFor] = useState<string>()
  // Text shared into the app (PWA share target: ?share_text=…), waiting to be filed in Updates.
  const [shareDraft, setShareDraft] = useState<string | undefined>(readShare)
  const osint = useOsint(now)
  const { adjust } = osint

  // Drop the share parameters from the address so a reload doesn't re-share.
  useEffect(() => {
    if (window.location.search.includes('share_')) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  useEffect(() => {
    let cancelled = false
    void getUserLocation().then((p) => !cancelled && setPlace(p))
    void loadSpots().then((s) => !cancelled && setSpots(s))
    void loadSettings().then((s) => !cancelled && setSettings(s))
    return () => {
      cancelled = true
    }
  }, [])

  // Name the GPS position ("Jaffa") once we have it.
  const lang = i18n.language
  const needsName = place?.source === 'gps' && !place.name
  useEffect(() => {
    if (!needsName || !place) return
    const controller = new AbortController()
    reverseGeocode(place, lang, controller.signal)
      .then((r) => r && setPlace((p) => (p && p.lat === place.lat && p.lng === place.lng ? { ...p, ...r } : p)))
      .catch(() => {})
    return () => controller.abort()
  }, [needsName, place, lang])

  const hereRaw = useForecast(place, attempt)
  const spotRaw = useForecasts(spots)
  // Forecasters' updates nudge every forecast the app shows (and the alerts built from them).
  const here: ForecastState = useMemo(
    () => (hereRaw.status === 'ready' && place ? { status: 'ready', days: adjust(hereRaw.days, place) } : hereRaw),
    [hereRaw, place, adjust],
  )
  const spotForecasts = useMemo(() => {
    const out: Record<string, ForecastState> = {}
    for (const s of spots) {
      const st = spotRaw[pointKey(s)]
      if (st) out[pointKey(s)] = st.status === 'ready' ? { status: 'ready', days: adjust(st.days, s) } : st
    }
    return out
  }, [spots, spotRaw, adjust])

  const placeName = place?.name ?? (place?.source === 'fallback' ? t('place.fallback') : t('place.current'))
  const today = here.status === 'ready' ? here.days[0] : undefined
  const dayKey = today ? `${today.date.toDateString()}|${place && pointKey(place)}` : ''
  const evening = tab === 'tonight' && !!today && isEvening(today.times, now) && eveningDismissedFor !== dayKey

  // Keep scheduled notifications in step with the latest forecasts and toggles.
  const spotsReady = spots.filter((s) => spotForecasts[pointKey(s)]?.status === 'ready').length
  const plan = useMemo(() => {
    if (here.status !== 'ready') return undefined
    return planNotifications(
      settings,
      { name: placeName, days: here.days },
      spots.flatMap((s) => {
        const st = spotForecasts[pointKey(s)]
        return st?.status === 'ready' ? [{ name: spotLabel(s, lang).name, days: st.days }] : []
      }),
      Date.now(),
      {
        remindTitle: (p) => t('notify.remindTitle', { place: p }),
        remindBody: (golden, sunset) => t('notify.remindBody', { golden, sunset }),
        greatTitle: (label, spot) => t('notify.greatTitle', { label, spot }),
        greatBody: (score, golden, min) => t('notify.greatBody', { score, golden, min }),
        label: (d) => t(`labels.${d.result.label}`),
        time: f.time,
      },
    )
    // spotsReady stands in for spotForecasts: reschedule when another spot's forecast arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, settings, placeName, spots, spotsReady, lang, t, f])
  // Forecasts are re-derived on every clock tick; only touch the OS schedule when the plan changes.
  const planKey = plan ? JSON.stringify(plan.map((n) => [n.id, +n.at, n.title, n.body])) : ''
  const scheduledKey = useRef('')
  useEffect(() => {
    if (!plan || planKey === scheduledKey.current) return
    scheduledKey.current = planKey
    void reschedule(plan)
  }, [plan, planKey])

  const onSettings = async (next: Settings) => {
    const turningOn =
      (next.remindGoldenHour && !settings.remindGoldenHour) || (next.alertGreatEvenings && !settings.alertGreatEvenings)
    if (turningOn && !(await ensurePermission())) {
      setBlocked(true)
      return
    }
    setBlocked(false)
    setSettings(next)
    void saveSettings(next)
  }

  const openTab = (next: Tab) => {
    if (next === 'map' && place) setMapPin((m) => m ?? { pin: place, n: 0 })
    setTab(next)
    window.scrollTo(0, 0)
  }
  const openMapAt = (pin: Place) => {
    setMapPin((m) => ({ pin, n: (m?.n ?? 0) + 1 }))
    setTab('map')
  }
  const locateMe = () => {
    setPlace(undefined)
    void getUserLocation().then(setPlace)
  }
  const toggleSave = (p: Place) => {
    const next = toggleSpot(spots, {
      lat: p.lat,
      lng: p.lng,
      name: p.name ?? t('place.dropped'),
      area: p.area,
    })
    setSpots(next)
    void saveSpots(next)
  }
  const isSaved = (p: LatLng) => spots.some((s) => sameSpot(s, p))

  return (
    <div className={evening ? 'app app-evening' : 'app'}>
      {!place && <p className="status">{t('locating')}</p>}

      {place && tab === 'tonight' && (
        <Tonight
          key={pointKey(place)}
          place={place}
          placeName={placeName}
          forecast={here}
          now={now}
          evening={evening}
          settings={settings}
          notificationsBlocked={blocked}
          onSettings={(s) => void onSettings(s)}
          onOpenMap={() => openMapAt(place)}
          onUseGps={locateMe}
          onRetry={() => setAttempt((a) => a + 1)}
          onDismissEvening={() => setEveningDismissedFor(dayKey)}
          onLanguage={() => void i18n.changeLanguage(lang === 'he' ? 'en' : 'he')}
          onOpenUpdates={() => openTab('updates')}
        />
      )}

      {place && tab === 'map' && mapPin && (
        <Suspense fallback={<p className="status">{t('map.loading')}</p>}>
          <MapScreen
            key={mapPin.n}
            place={place}
            initialPin={mapPin.pin}
            isSaved={isSaved}
            onToggleSave={toggleSave}
            onUse={(p) => {
              setPlace({ ...p, source: 'map' })
              setTab('tonight')
            }}
            onOpenHistory={(p, focus) => {
              setHistory({ place: p, focus })
              setTab('history')
            }}
            adjust={adjust}
          />
        </Suspense>
      )}

      {place && tab === 'spots' && (
        <Spots
          spots={spots}
          forecasts={spotForecasts}
          onOpen={(s) => {
            const l = spotLabel(s, lang)
            openMapAt({ lat: s.lat, lng: s.lng, name: l.name, area: l.area, source: 'map' })
          }}
        />
      )}

      {place && tab === 'updates' && (
        <Updates
          osint={osint}
          place={place}
          placeName={placeName}
          today={today}
          now={now}
          shareDraft={shareDraft}
          onDraftDone={() => setShareDraft(undefined)}
          onOpenHistory={(focus) => {
            setHistory({ place, focus })
            setTab('history')
            window.scrollTo(0, 0)
          }}
        />
      )}

      {place && tab === 'history' && (
        <History
          key={`${pointKey(history?.place ?? place)}|${history?.focus?.getTime() ?? ''}`}
          place={history?.place ?? place}
          placeName={history?.place.name ?? placeName}
          focusDate={history?.focus}
        />
      )}

      <TabBar
        tab={tab}
        dark={evening}
        onTab={(next) => {
          if (next === 'history') setHistory(undefined)
          openTab(next)
        }}
      />
    </div>
  )
}
