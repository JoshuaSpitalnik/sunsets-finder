import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { detectSource, OTHER_SOURCE, SOURCE_LIST } from '../lib/osint/feed'
import type { OsintPost } from '../lib/osint/types'

interface Props {
  /** Text arriving from the share sheet, if any. */
  initialText?: string
  onAdd: (post: OsintPost) => void
  onCancel: () => void
}

/** "YYYY-MM-DDTHH:mm" in local time, for <input type="datetime-local">. */
const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Paste (or receive via Share) a post from WhatsApp or anywhere, and say who posted it and when. */
export function AddPostCard({ initialText = '', onAdd, onCancel }: Props) {
  const { t, i18n } = useTranslation()
  const [text, setText] = useState(initialText)
  const [source, setSource] = useState(() => detectSource(initialText) ?? 'tal-shamai')
  const [postedAt, setPostedAt] = useState(() => localInput(new Date()))
  const lang = i18n.language === 'he' ? 'he' : 'en'

  return (
    <form
      className="card add-post"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        const published = new Date(postedAt)
        onAdd({
          id: `shared:${Date.now()}`,
          sourceId: source,
          text: text.trim(),
          publishedAt: (Number.isNaN(+published) ? new Date() : published).toISOString(),
          shared: true,
        })
      }}
    >
      <h2 className="card-title">{t('osint.add')}</h2>
      <p className="fine-print">{t('osint.addHint')}</p>
      <label className="field">
        <span>{t('osint.text')}</span>
        <textarea
          rows={6}
          value={text}
          dir="auto"
          onChange={(e) => {
            setText(e.target.value)
            const detected = detectSource(e.target.value)
            if (detected) setSource(detected)
          }}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>{t('osint.source')}</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCE_LIST.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name[lang]}
              </option>
            ))}
            <option value={OTHER_SOURCE}>{t('osint.other')}</option>
          </select>
        </label>
        <label className="field">
          <span>{t('osint.postedAt')}</span>
          <input type="datetime-local" value={postedAt} onChange={(e) => setPostedAt(e.target.value)} />
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button small" disabled={!text.trim()}>
          {t('osint.save')}
        </button>
        <button type="button" className="chip-button" onClick={onCancel}>
          {t('osint.cancel')}
        </button>
      </div>
    </form>
  )
}
