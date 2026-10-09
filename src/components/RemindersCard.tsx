import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Capacitor } from '@capacitor/core'
import { useFormat } from '../i18n/useFormat'
import { REMIND_BEFORE_MIN } from '../lib/notifications'
import type { Settings } from '../lib/prefs'
import { Toggle } from './Toggle'

interface Props {
  settings: Settings
  onChange: (next: Settings) => void
  goldenHour: Date
  /** Notification permission was refused. */
  blocked: boolean
}

/** The two alert toggles (design 1a), wired to local notifications (design 1d). */
export const RemindersCard = forwardRef<HTMLElement, Props>(function RemindersCard(
  { settings, onChange, goldenHour, blocked },
  ref,
) {
  const { t } = useTranslation()
  const f = useFormat()
  const remindAt = new Date(+goldenHour - REMIND_BEFORE_MIN * 60_000)

  return (
    <section className="card toggles-card" ref={ref} aria-label={t('tonightScreen.remindersLabel')}>
      <div className="toggle-row">
        <div className="toggle-text">
          <span>{t('reminders.golden')}</span>
          <span className="muted-sm">
            {settings.remindGoldenHour ? t('reminders.goldenAt', { time: f.time(remindAt) }) : t('reminders.off')}
          </span>
        </div>
        <Toggle
          on={settings.remindGoldenHour}
          label={t('reminders.golden')}
          onChange={(on) => onChange({ ...settings, remindGoldenHour: on })}
        />
      </div>
      <hr className="hairline" />
      <div className="toggle-row">
        <div className="toggle-text">
          <span>{t('reminders.great')}</span>
          <span className="muted-sm">{t('reminders.greatSub')}</span>
        </div>
        <Toggle
          on={settings.alertGreatEvenings}
          label={t('reminders.great')}
          onChange={(on) => onChange({ ...settings, alertGreatEvenings: on })}
        />
      </div>
      {blocked && <p className="toggle-note">{t('reminders.blocked')}</p>}
      {!blocked && !Capacitor.isNativePlatform() && (settings.remindGoldenHour || settings.alertGreatEvenings) && (
        <p className="toggle-note">{t('reminders.webNote')}</p>
      )}
    </section>
  )
})
