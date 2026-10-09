import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localeFor } from '../i18n'
import type { LatLng } from '../lib/geo'
import { fetchSunsetPhotos, type SunsetPhoto } from '../lib/photos'
import { HISTORY_START } from '../lib/weather'

interface Props {
  at: LatLng
  /** Open the history view for the day a photo was taken. */
  onCheckDate?: (date: Date) => void
}

type State = { status: 'loading' } | { status: 'ready'; photos: SunsetPhoto[] } | { status: 'error' }

/** Real sunset photos taken near a point, from Wikimedia Commons. Remount (key) when the point changes. */
export function PhotoGallery({ at, onCheckDate }: Props) {
  const { t, i18n } = useTranslation()
  const [state, setState] = useState<State>({ status: 'loading' })
  const { lat, lng } = at
  const dateFmt = new Intl.DateTimeFormat(localeFor(i18n.language), { dateStyle: 'medium' })

  useEffect(() => {
    const controller = new AbortController()
    fetchSunsetPhotos({ lat, lng }, 10, controller.signal)
      .then((photos) => setState({ status: 'ready', photos }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [lat, lng])

  return (
    <section className="photos">
      {state.status === 'loading' && <p className="muted-sm">{t('photos.loading')}</p>}
      {state.status === 'error' && <p className="muted-sm">{t('photos.error')}</p>}
      {state.status === 'ready' && state.photos.length === 0 && <p className="muted-sm">{t('photos.none')}</p>}
      {state.status === 'ready' && state.photos.length > 0 && (
        <ul className="photo-strip">
          {state.photos.map((p) => (
            <li key={p.pageUrl} className="photo">
              <a href={p.pageUrl} target="_blank" rel="noreferrer">
                <img src={p.thumbUrl} alt={p.title} loading="lazy" />
              </a>
              <div className="photo-meta">
                {p.takenAt && <span>{dateFmt.format(p.takenAt)}</span>}
                <span className="photo-credit">
                  {[p.artist, p.license].filter(Boolean).join(' · ')}
                </span>
                {p.takenAt && p.takenAt >= HISTORY_START && onCheckDate && (
                  <button className="text-link" onClick={() => onCheckDate(p.takenAt!)}>
                    {t('photos.checkDay')}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="fine-print">{t('photos.source')}</p>
    </section>
  )
}
