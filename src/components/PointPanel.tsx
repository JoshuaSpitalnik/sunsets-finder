import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { googleMapsUrl, reverseGeocode, wazeUrl, type Place } from '../lib/location'
import { fetchSunsetForecast, type DayForecast } from '../lib/weather'
import { DayDetail } from './DayDetail'
import { PhotoGallery } from './PhotoGallery'

interface Props {
  point: Place
  onSetPlace: (place: Place) => void
  onOpenHistory: (date: Date, place: Place) => void
}

/** Everything about a tapped point: name, tonight's sunset there, navigation and real photos. */
export function PointPanel({ point, onSetPlace, onOpenHistory }: Props) {
  const { t, i18n } = useTranslation()
  const [name, setName] = useState(point.name)
  const [today, setToday] = useState<DayForecast | 'error' | undefined>()
  const { lat, lng } = point
  const named: Place = { ...point, name }

  useEffect(() => {
    const controller = new AbortController()
    if (!point.name) {
      reverseGeocode({ lat, lng }, i18n.language, controller.signal)
        .then((n) => n && setName(n))
        .catch(() => {})
    }
    fetchSunsetForecast({ lat, lng }, controller.signal)
      .then((days) => setToday(days[0]))
      .catch(() => {
        if (!controller.signal.aborted) setToday('error')
      })
    return () => controller.abort()
    // One fetch per point — the panel is remounted (keyed) for a new point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="point-panel">
      <h2>{name ?? t('pickedOnMap')}</h2>
      <p className="coords">
        <bdi dir="ltr">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </bdi>
      </p>
      <div className="actions">
        <button onClick={() => onSetPlace(named)}>{t('map.setLocation')}</button>
        <a className="button" href={wazeUrl(point)} target="_blank" rel="noreferrer">
          Waze
        </a>
        <a className="button" href={googleMapsUrl(point)} target="_blank" rel="noreferrer">
          Google Maps
        </a>
      </div>

      <h3>{t('tonight')}</h3>
      {today === undefined && <p className="muted">{t('loadingForecast')}</p>}
      {today === 'error' && <p className="muted">{t('error')}</p>}
      {today && today !== 'error' && <DayDetail day={today} compact />}

      <PhotoGallery at={point} onCheckDate={(date) => onOpenHistory(date, named)} />
    </section>
  )
}
