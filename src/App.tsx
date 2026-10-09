import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUserLocation, type Place } from './lib/location'
import { History } from './screens/History'
import { Tonight } from './screens/Tonight'

// MapLibre is large — only load it when the map tab is opened.
const MapScreen = lazy(() => import('./screens/MapScreen'))

type Tab = 'tonight' | 'map' | 'history'
const TABS: { id: Tab; icon: string }[] = [
  { id: 'tonight', icon: '☀' },
  { id: 'map', icon: '⌖' },
  { id: 'history', icon: '↺' },
]

const placeKey = (p: Place) => `${p.lat},${p.lng}`

export default function App() {
  const { t, i18n } = useTranslation()
  const [place, setPlace] = useState<Place | undefined>()
  const [tab, setTab] = useState<Tab>('tonight')
  const [historyFocus, setHistoryFocus] = useState<Date | undefined>()

  useEffect(() => {
    let cancelled = false
    getUserLocation().then((p) => {
      if (!cancelled) setPlace(p)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const locateMe = () => {
    setPlace(undefined)
    void getUserLocation().then(setPlace)
  }
  const openTab = (next: Tab) => {
    if (next === 'history') setHistoryFocus(undefined)
    setTab(next)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>{t('appName')}</h1>
        <button className="link" onClick={() => void i18n.changeLanguage(i18n.language === 'he' ? 'en' : 'he')}>
          {t('language')}
        </button>
      </header>

      {!place && <p className="status">{t('locating')}</p>}
      {place && tab === 'tonight' && (
        <Tonight key={placeKey(place)} place={place} onUseGps={locateMe} onOpenMap={() => openTab('map')} />
      )}
      {place && tab === 'map' && (
        <Suspense fallback={<p className="status">{t('map.loading')}</p>}>
          <MapScreen
            place={place}
            onSetPlace={(p) => {
              setPlace(p)
              openTab('tonight')
            }}
            onOpenHistory={(p, date) => {
              setPlace(p)
              setHistoryFocus(date)
              setTab('history')
              window.scrollTo(0, 0)
            }}
          />
        </Suspense>
      )}
      {place && tab === 'history' && (
        <History
          key={`${placeKey(place)}|${historyFocus?.getTime() ?? ''}`}
          place={place}
          focusDate={historyFocus}
          onUseGps={locateMe}
          onOpenMap={() => openTab('map')}
        />
      )}

      <footer className="muted">{t('footer')}</footer>

      <nav className="tabbar">
        {TABS.map(({ id, icon }) => (
          <button key={id} className="tab" aria-current={tab === id ? 'page' : undefined} onClick={() => openTab(id)}>
            <span aria-hidden="true">{icon}</span>
            {t(`tabs.${id}`)}
          </button>
        ))}
      </nav>
    </div>
  )
}
