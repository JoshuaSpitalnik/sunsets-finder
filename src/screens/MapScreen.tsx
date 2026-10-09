import { Map as MapLibre, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Feature, FeatureCollection } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PointPanel } from '../components/PointPanel'
import { destination, type LatLng } from '../lib/geo'
import { searchPlaces, type Place } from '../lib/location'
import { getSunsetTimes } from '../lib/sun'

// MapLibre looks for its worker next to its own file, which bundling moves — point it at the emitted asset.
setWorkerUrl(workerUrl)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
/** How far to draw the sunset direction line from a point. */
const SUN_LINE_KM = 40

interface Props {
  place: Place
  onSetPlace: (place: Place) => void
  onOpenHistory: (place: Place, date: Date) => void
}

const point = (p: LatLng): Feature => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
})
const empty: FeatureCollection = { type: 'FeatureCollection', features: [] }

function sunLine(p: LatLng): Feature {
  const end = destination(p, getSunsetTimes(new Date(), p).azimuth, SUN_LINE_KM)
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates: [[p.lng, p.lat], [end.lng, end.lat]] },
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

export default function MapScreen({ place, onSetPlace, onOpenHistory }: Props) {
  const { t, i18n } = useTranslation()
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibre | null>(null)
  const [ready, setReady] = useState(false)
  const [picked, setPicked] = useState<Place | undefined>()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[] | undefined>()
  const [searchError, setSearchError] = useState(false)

  // Create the map once.
  useEffect(() => {
    if (!container.current) return
    const map = new MapLibre({
      container: container.current,
      style: STYLE_URL,
      center: [place.lng, place.lat],
      zoom: 12,
    })
    mapRef.current = map
    map.on('load', () => {
      map.addSource('me', { type: 'geojson', data: empty })
      map.addSource('picked', { type: 'geojson', data: empty })
      map.addSource('sunline', { type: 'geojson', data: empty })
      map.addLayer({
        id: 'sunline',
        type: 'line',
        source: 'sunline',
        paint: { 'line-color': '#f08a4b', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      })
      map.addLayer({
        id: 'me',
        type: 'circle',
        source: 'me',
        paint: { 'circle-radius': 8, 'circle-color': '#4a90ff', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      })
      map.addLayer({
        id: 'picked',
        type: 'circle',
        source: 'picked',
        paint: { 'circle-radius': 9, 'circle-color': '#e8466b', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      })
      setReady(true)
    })
    map.on('click', (e) => {
      setPicked({ lat: e.lngLat.lat, lng: e.lngLat.lng, source: 'map' })
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
    // The map is created once; later place changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (ready && mapRef.current) localizeLabels(mapRef.current, i18n.language)
  }, [ready, i18n.language])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    map.getSource<GeoJSONSource>('me')?.setData(point(place))
  }, [ready, place])

  useEffect(() => {
    const map = mapRef.current
    if (!ready || !map) return
    const target = picked ?? place
    map.getSource<GeoJSONSource>('picked')?.setData(picked ? point(picked) : empty)
    map.getSource<GeoJSONSource>('sunline')?.setData(sunLine(target))
  }, [ready, picked, place])

  const flyTo = (p: LatLng) => mapRef.current?.flyTo({ center: [p.lng, p.lat], zoom: 14 })

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearchError(false)
    try {
      setResults(await searchPlaces(query.trim(), i18n.language))
    } catch {
      setSearchError(true)
    }
  }

  return (
    <main className="map-screen">
      <form className="map-search" onSubmit={onSearch}>
        <input
          type="search"
          value={query}
          placeholder={t('map.searchPlaceholder')}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t('map.searchPlaceholder')}
        />
        <button type="submit">{t('map.search')}</button>
      </form>
      {searchError && <p className="muted">{t('map.searchError')}</p>}
      {results && (
        <ul className="search-results">
          {results.length === 0 && <li className="muted">{t('map.noResults')}</li>}
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button
                className="link"
                onClick={() => {
                  setPicked(r)
                  setResults(undefined)
                  flyTo(r)
                }}
              >
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="map-wrap">
        <div ref={container} className="map" />
        <button className="map-recenter" onClick={() => flyTo(place)} aria-label={t('map.recenter')}>
          ◎
        </button>
      </div>
      <p className="muted small legend">
        <span className="dot dot-me" /> {t('map.legendMe')} <span className="dot dot-picked" /> {t('map.legendPicked')}{' '}
        <span className="dash" /> {t('map.legendLine')}
      </p>

      {picked ? (
        <PointPanel
          key={`${picked.lat},${picked.lng}`}
          point={picked}
          onSetPlace={onSetPlace}
          onOpenHistory={(date, named) => onOpenHistory(named, date)}
        />
      ) : (
        <p className="status">{t('map.tapHint')}</p>
      )}
    </main>
  )
}
