import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import he from './he.json'
import en from './en.json'

export type Lang = 'he' | 'en'
const STORAGE_KEY = 'lang'

function storedLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'he'
  } catch {
    return 'he'
  }
}

/** Keep <html lang/dir> in sync so the whole layout mirrors via CSS logical properties. */
function applyDocumentDirection(lang: string) {
  document.documentElement.lang = lang
  document.documentElement.dir = i18n.dir(lang)
}

i18n.on('languageChanged', (lang) => {
  applyDocumentDirection(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage unavailable (private mode) — language just won't persist.
  }
})

void i18n.use(initReactI18next).init({
  resources: { he: { translation: he }, en: { translation: en } },
  lng: storedLang(),
  fallbackLng: 'he',
  interpolation: { escapeValue: false },
})
applyDocumentDirection(i18n.language)

/** BCP-47 locale for Intl formatting. */
export const localeFor = (lang: string) => (lang === 'en' ? 'en-GB' : 'he-IL')

export default i18n
