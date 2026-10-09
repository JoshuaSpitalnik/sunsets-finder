import { Map as MapLibre, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { FeatureCollection } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { IconLocate, IconSearch } from '../components/Icons'
import { MapSheet } from '../components/MapSheet'
import { destination, type LatLng } from '../lib/geo'
import { reverseGeocode, searchPlaces, type Place } from '../lib/location'
import { getSunsetTimes } from '../lib/sun'
import { LABEL_COLOR } from '../lib/theme'
import { useForecast, type ForecastState } from '../lib/useForecasts'
import type { DayForecast } from '../lib/weather'

// MapLibre looks for its worker next to its own file, which bundling moves — point it at the emitted asset.
setWorkerUrl(workerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron'
/** Length of the sunset-direction line drawn from the pin. */
const SUN_LINE_KM = 30

interface Props {
  /** Your current place (blue dot). */
  place: Place
  /** Where the pin starts (a spot opened from Spots/Tonight), or your place. */
  initialPin: Place
  isSaved: (p: LatLng) => boolean
  onToggleSave: (p: Place) => void
  onUse: (p: Place) => void
  onOpenHistory: (p: Place, date: Date) => void
  /** Apply forecasters' updates to the pin's forecast. */
  adjust: (days: DayForecast[], at: LatLng) => DayForecast[]
}

function sunGeo(p: LatLng): FeatureCollection {
  const end = destination(p, getSunsetTimes(new Date(), p).azimuth, SUN_LINE_KM)
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[p.lng, p.lat], [end.lng, end.lat]] } },
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [end.lng, end.lat] } },
    ],
  }
}

/** Show map labels in the app language, falling back to the local name. */
function localizeLabels(map: MapLibre, lang: string) {
  const field = lang === 'he' ? 'name:he' : 'name:en'
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'symbol' && layer.layout?.['text-field']) {
      map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', field], ['get', 'name']])
    }
  }
}

export default function MapScreen({ place, initialPin, isSaved, onToggleSave, onUse, onOpenHistory, adjust }: Props) {
  const { t, i18n } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const pinMarker = useRef<Marker | null>(null)
  const meMarker = useRef<Marker | null>(null)
  // The pin's DOM node lives inside MapLibre; React renders the score glyph into it via a portal.
  const [pinEl] = useState(() => {
    const el = document.createElement('div')
    el.className = 'map-pin'
    return el
  })
  const [ready, setReady] = useState(false)
  const [pin, setPin] = useState<Place>(initialPin)
  const [hint, setHint] = useState(true)
  const [query, setQuery] = useState('')
  const [searchState, setSearchState] = useState<'idle' | 'searching' | 'none' | 'error'>('idle')
  const raw = useForecast(pin)
  const forecast: ForecastState = raw.status === 'ready' ? { status: 'ready', days: adjust(raw.days, pin) } : raw
  const day = forecast.status === 'ready' ? forecast.days[0] : undefined
  const lang = i18n.language
  const revId = useRef(0)

  const dropPin = (at: LatLng, named?: { name?: string; area?: string }) => {
    setHint(false)
    setPin({ lat: at.lat, lng: at.lng, name: named?.name, area: named?.area, source: 'map' })
    if (named?.name) return
    const id = ++revId.current
    reverseGeocode(at, lang)
      .then((r) => {
        if (r && id === revId.current) setPin((p) => ({ ...p, name: r.name, area: r.area }))
      })
      .catch(() => {})
  }
  // Map event handlers are bound once; keep them pointed at the latest closure.
  const dropRef = useRef(dropPin)
  useEffect(() => {
    dropRef.current = dropPin
  })

  // Create the map once.
  useEffect(() => {
    if (!container.current) return
    const map = new MapLibre({
      container: container.current,
      style: STYLE_URL,
      center: [initialPin.lng, initialPin.lat],
      zoom: 11.3,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    const me = document.createElement('div')
    me.className = 'map-me'
    meMarker.current = new Marker({ element: me }).setLngLat([place.lng, place.lat]).addTo(map)

    const marker = new Marker({ element: pinEl, draggable: true, anchor: 'bottom' })
      .setLngLat([initialPin.lng, initialPin.lat])
      .addTo(map)
    pinMarker.current = marker
    marker.on('dragstart', () => setHint(false))
    marker.on('drag', () => {
      const p = marker.getLngLat()
      map.getSource<GeoJSONSource>('sun')?.setData(sunGeo({ lat: p.lat, lng: p.lng }))
    })
    marker.on('dragend', () => {
      const p = marker.getLngLat()
      dropRef.current({ lat: p.lat, lng: p.lng })
    })
    map.on('click', (e) => dropRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }))

    map.on('load', () => {
      map.addSource('sun', { type: 'geojson', data: sunGeo(initialPin) })
      map.addLayer({
        id: 'sun-glow',
        type: 'line',
        source: 'sun',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#F2A061', 'line-width': 10, 'line-opacity': 0.25, 'line-blur': 3 },
      })
      map.addLayer({
        id: 'sun-line',
        type: 'line',
        source: 'sun',
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#E06A33', 'line-width': 2.5, 'line-dasharray': [1.5, 1.5] },
      })
      map.addLayer({
        id: 'sun-end',
        type: 'circle',
        source: 'sun',
        filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 7, 'circle-color': '#F2A061', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 },
      })
      setReady(true)
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // The map is created once; later changes are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready && mapRef.current) localizeLabels(mapRef.current, lang)
  }, [ready, lang])

  useEffect(() => {
    meMarker.current?.setLngLat([place.lng, place.lat])
  }, [place.lat, place.lng])

  useEffect(() => {
    pinMarker.current?.setLngLat([pin.lng, pin.lat])
    if (ready) mapRef.current?.getSource<GeoJSONSource>('sun')?.setData(sunGeo(pin))
  }, [ready, pin])

  const flyTo = (p: LatLng, zoom = 13) => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom, duration: 900 })

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    setSearchState('searching')
    try {
      const [first] = await searchPlaces(q, lang)
      if (!first) return setSearchState('none')
      setSearchState('idle')
      dropPin(first, { name: first.name, area: first.area })
      flyTo(first)
    } catch {
      setSearchState('error')
    }
  }

  const pinColor = day ? LABEL_COLOR[day.result.label] : '#9C958B'

  return (
    <main className="map-screen">
      <div ref={container} className="map-canvas" />
      {createPortal(
        <svg width="48" height="58" viewBox="0 0 48 58" role="img" aria-label={day ? `${day.result.score}` : ''}>
          <path d="M24 56C24 56 5 36 5 22a19 19 0 0 1 38 0c0 14-19 34-19 34z" fill={pinColor} stroke="#fff" strokeWidth="3" />
          <text x="24" y="28" textAnchor="middle" fontSize="15" fontWeight="700" fill="#fff">
            {day ? day.result.score : '…'}
          </text>
        </svg>,
        pinEl,
      )}

      <form className="map-search glass" onSubmit={onSearch} role="search">
        <IconSearch />
        <input
          type="search"
          value={query}
          placeholder={t('map.searchPlaceholder')}
          aria-label={t('map.searchPlaceholder')}
          onChange={(e) => {
            setQuery(e.target.value)
            if (searchState !== 'searching') setSearchState('idle')
          }}
        />
        {searchState === 'searching' && <span className="muted-sm">{t('map.searching')}</span>}
        {searchState === 'none' && <span className="muted-sm">{t('map.noResults')}</span>}
        {searchState === 'error' && <span className="muted-sm">{t('map.searchError')}</span>}
      </form>
      {hint && <div className="map-hint">{t('map.hint')}</div>}

      <div className="map-bottom">
        <button className="map-locate glass" aria-label={t('map.locate')} onClick={() => flyTo(place, 12.5)}>
          <IconLocate />
        </button>
        <MapSheet
          pin={pin}
          forecast={forecast}
          saved={isSaved(pin)}
          onUse={() => onUse(pin)}
          onToggleSave={() => onToggleSave(pin)}
          onCheckDate={(date) => onOpenHistory(pin, date)}
        />
      </div>
    </main>
  )
}
