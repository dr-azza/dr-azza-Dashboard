import { ar, dirFor, en, localeFor } from '@azza/i18n'
import type { L, Lang } from '@azza/shared'
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { readPref, writePref } from '@/lib/prefs'

export type { L, Lang }

const STORAGE_KEY = 'lang'

function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = dirFor(lang)
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ar: { translation: ar } },
  lng: readPref(STORAGE_KEY, ['en', 'ar'] as const, 'en'),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

applyDocumentLang(i18n.language as Lang)
i18n.on('languageChanged', (lang) => {
  applyDocumentLang(lang as Lang)
  writePref(STORAGE_KEY, lang)
})

export function useLang() {
  const { t, i18n: instance } = useTranslation()
  const lang: Lang = instance.language === 'ar' ? 'ar' : 'en'
  return {
    t,
    lang,
    /** Pick the current language from a bilingual value. */
    l: (value: L) => value[lang],
    toggle: () => instance.changeLanguage(lang === 'ar' ? 'en' : 'ar'),
    formatDate: (date: Date, options: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(localeFor(lang), options).format(date),
  }
}

export default i18n
