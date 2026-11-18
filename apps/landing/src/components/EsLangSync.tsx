'use client'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

// Dedicated language routes keep the client UI and stored preference aligned.
// Existing Spanish routes default to es; the English article route passes en.
export default function EsLangSync({ lang = 'es' }: { lang?: 'en' | 'es' }) {
  const { i18n } = useTranslation()
  useEffect(() => {
    if (!i18n.language.startsWith(lang)) i18n.changeLanguage(lang)
    try {
      localStorage.setItem('ildr_lang', lang)
    } catch {
      /* ignore */
    }
  }, [i18n, lang])
  return null
}
