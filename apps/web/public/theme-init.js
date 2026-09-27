// Applies the saved theme and language before first paint (no flash). A plain file, loaded
// synchronously from <head>, so the strict production Content-Security-Policy allows it.
// Keep in sync with src/lib/theme.ts and src/i18n.
/* global document, localStorage, matchMedia */
;(function () {
  var root = document.documentElement
  try {
    var theme = localStorage.getItem('theme')
    var dark = theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    if (localStorage.getItem('lang') === 'ar') {
      root.lang = 'ar'
      root.dir = 'rtl'
    }
  } catch {
    // Storage blocked (private mode): defaults apply.
  }
})()
