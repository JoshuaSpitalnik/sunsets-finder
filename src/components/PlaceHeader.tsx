import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Place } from '../lib/location'

interface Props {
  place: Place
  onUseGps?: () => void
  onOpenMap?: () => void
}

/** Where the forecast is for: name/accuracy, exact coordinates, and ways to change it. */
export function PlaceHeader({ place, onUseGps, onOpenMap }: Props) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const coords = `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`

  const copyCoords = async () => {
    try {
      await navigator.clipboard.writeText(coords)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked — the coordinates stay visible and selectable.
    }
  }

  return (
    <section className="location">
      <p className="place-name">
        {place.name ??
          (place.source === 'gps'
            ? t('myLocation')
            : place.source === 'fallback'
              ? t('defaultLocation')
              : t('pickedOnMap'))}
      </p>
      {place.source === 'gps' && <p className="muted">{t('accuracy', { m: place.accuracyM })}</p>}
      <div className="coords">
        <bdi dir="ltr">{coords}</bdi>
        <button className="link" onClick={copyCoords}>
          {copied ? t('copied') : t('copyCoords')}
        </button>
        {onOpenMap && (
          <button className="link" onClick={onOpenMap}>
            {t('changeOnMap')}
          </button>
        )}
        {onUseGps && (
          <button className="link" onClick={onUseGps}>
            {place.source === 'gps' ? t('refreshLocation') : t('useGps')}
          </button>
        )}
      </div>
    </section>
  )
}
