import { useTranslation } from 'react-i18next'
import { Tonight } from './screens/Tonight'

export default function App() {
  const { t, i18n } = useTranslation()
  return (
    <div className="app">
      <header className="topbar">
        <h1>{t('appName')}</h1>
        <button className="link" onClick={() => void i18n.changeLanguage(i18n.language === 'he' ? 'en' : 'he')}>
          {t('language')}
        </button>
      </header>
      <Tonight />
      <footer className="muted">{t('footer')}</footer>
    </div>
  )
}
