export { ar } from './ar.js'
export { en, type Messages } from './en.js'

/** Locale for dates and numbers. Arabic keeps Latin digits, which staff read faster in clinical values. */
export function localeFor(lang: 'en' | 'ar') {
  return lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB'
}

export function dirFor(lang: 'en' | 'ar') {
  return lang === 'ar' ? 'rtl' : 'ltr'
}
