import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { localeFromHashOrDefault } from './locale'
import { defaultLocale, resources } from './resources'

void i18next.use(initReactI18next).init({
  fallbackLng: defaultLocale,
  interpolation: {
    escapeValue: false,
  },
  lng: localeFromHashOrDefault(window.location.hash),
  resources,
})

window.addEventListener('hashchange', () => {
  void i18next.changeLanguage(localeFromHashOrDefault(window.location.hash))
})

export { i18next }
