import { defaultLocale, locales, type Locale } from './resources'

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale)
}

export function localeFromHash(hash: string): Locale | undefined {
  const value = hash.replace(/^#/, '')

  return isLocale(value) ? value : undefined
}

export function localeFromHashOrDefault(hash: string): Locale {
  return localeFromHash(hash) ?? defaultLocale
}
