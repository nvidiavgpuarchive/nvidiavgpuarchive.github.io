import { ar } from './locales/ar'
import { de } from './locales/de'
import { en } from './locales/en'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { hi } from './locales/hi'
import { ja } from './locales/ja'
import { ko } from './locales/ko'
import { ptBR } from './locales/pt-BR'
import { zhHans } from './locales/zh-Hans'
import { zhHant } from './locales/zh-Hant'

export const locales = ['en', 'zh-Hans', 'zh-Hant', 'es', 'fr', 'de', 'pt-BR', 'ja', 'ko', 'ar', 'hi'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'en'

export const resources = {
  ar: {
    translation: ar,
  },
  de: {
    translation: de,
  },
  en: {
    translation: en,
  },
  es: {
    translation: es,
  },
  fr: {
    translation: fr,
  },
  hi: {
    translation: hi,
  },
  ja: {
    translation: ja,
  },
  ko: {
    translation: ko,
  },
  'pt-BR': {
    translation: ptBR,
  },
  'zh-Hans': {
    translation: zhHans,
  },
  'zh-Hant': {
    translation: zhHant,
  },
} as const
