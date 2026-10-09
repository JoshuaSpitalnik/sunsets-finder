import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormat } from '../i18n/useFormat'
import { googleMapsUrl, wazeUrl, type Place } from '../lib/location'
import { summaryKeys } from '../lib/score'
import { LABEL_COLOR } from '../lib/theme'
import type { ForecastState } from '../lib/useForecasts'
import { IconArrowEnd, IconBookmark, IconCar, IconChevronDown, IconPhoto } from './Icons'
import { PhotoGallery } from './PhotoGallery'

interface Props {
  pin: Place
  forecast: ForecastState
  saved: boolean
  onUse: () => void
  onToggleSave: () => void
  onCheckDate: (date: Date) => void
}

/** The map's bottom sheet: the pin's score tonight, timings, actions and nearby photos. */
export function MapSheet({ pin, forecast, saved, onUse, onToggleSave, onCheckDate }: Props) {
  const { t } = useTranslation()
  const f = useFormat()
  const [photosOpen, setPhotosOpen] = useState(false)
  const day = forecast.status === 'ready' ? forecast.days[0] : undefined
  const color = day ? LABEL_COLOR[day.result.label] : '#9C958B'
  const summary = day ? summaryKeys(day.result) : undefined

  return (
    <section className="map-sheet" aria-live="polite">
      <span className="sheet-handle" aria-hidden="true" />
      <div className="map-sheet-head">
        <div className="map-sheet-name">
          <h2>{pin.name ?? t('place.dropped')}</h2>
          <span className="muted-sm">
            {pin.area ? `${pin.area} · ` : ''}
            <bdi dir="ltr">
              {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}
            </bdi>
          </span>
        </div>
        <div className="map-sheet-score" style={{ color }}>
          <bdi className="serif-number">{day ? day.result.score : '…'}</bdi>
          <span>{day ? t(`labels.${day.result.label}`) : ''}</span>
        </div>
      </div>

      {forecast.status === 'error' && <p className="muted-sm">{t('error')}</p>}
      {day && summary && (
        <>
          <div className="tiles">
            <div className="tile">
              <span>{t('map.golden')}</span>
              <bdi>{f.time(day.times.goldenHour)}</bdi>
            </div>
            <div className="tile">
              <span>{t('map.sunset')}</span>
              <bdi>{f.time(day.times.sunset)}</bdi>
            </div>
            <div className="tile">
              <span>{t('map.face')}</span>
              <bdi>
                {f.compassShort(day.times.azimuth)} {Math.round(day.times.azimuth)}°
              </bdi>
            </div>
          </div>
          <p className="map-sheet-summary">
            {t(summary.head)} {t(summary.detail)}
          </p>
        </>
      )}

      <div className="map-sheet-actions">
        <button className="primary-button" onClick={onUse}>
          {t('map.useSpot')}
        </button>
        <button className="soft-button" aria-pressed={saved} onClick={onToggleSave}>
          <IconBookmark size={15} filled={saved} />
          {saved ? t('map.saved') : t('map.save')}
        </button>
        <a className="soft-round" href={wazeUrl(pin)} target="_blank" rel="noreferrer" aria-label={t('map.waze')}>
          <IconCar />
        </a>
        <a className="soft-round" href={googleMapsUrl(pin)} target="_blank" rel="noreferrer" aria-label={t('map.directions')}>
          <IconArrowEnd />
        </a>
      </div>

      <button className="photos-toggle" aria-expanded={photosOpen} onClick={() => setPhotosOpen(!photosOpen)}>
        <IconPhoto />
        <span>{t('map.photos')}</span>
        <span className={photosOpen ? 'chevron chevron-open' : 'chevron'}>
          <IconChevronDown />
        </span>
      </button>
      {photosOpen && <PhotoGallery key={`${pin.lat},${pin.lng}`} at={pin} onCheckDate={onCheckDate} />}
    </section>
  )
}
