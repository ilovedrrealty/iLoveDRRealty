'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import i18n from '../i18n'
import client from '../api/axios'
import { emptyWebsiteSettings, type WebsiteSettings, type WebsiteSettingsResponse } from '../../../../packages/website-settings/src'

const WebsiteContext = createContext<WebsiteSettings>(emptyWebsiteSettings())
const originalCopy = new Map<string, unknown>()

function applyCopy(settings: WebsiteSettings) {
  for (const language of ['en', 'es'] as const) {
    const namespaces = new Set([
      ...Object.keys(settings.translations[language] ?? {}),
      ...[...originalCopy.keys()].filter(key => key.startsWith(`${language}:`)).map(key => key.split(':')[1]),
    ])
    for (const namespace of namespaces) {
      const key = `${language}:${namespace}`
      if (!originalCopy.has(key)) originalCopy.set(key, structuredClone(i18n.getResourceBundle(language, namespace) ?? {}))
      i18n.removeResourceBundle(language, namespace)
      i18n.addResourceBundle(language, namespace, structuredClone(originalCopy.get(key)), true, true)
      for (const [path, text] of Object.entries(settings.translations[language]?.[namespace] ?? {})) {
        i18n.addResource(language, namespace, path, text)
      }
    }
  }
  if (originalCopy.size) void i18n.changeLanguage(i18n.language)
}

export default function WebsiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WebsiteSettings>(emptyWebsiteSettings)
  useEffect(() => {
    let cancelled = false
    let version = -1
    let loading = false
    const refresh = async () => {
      if ((document.hidden && version >= 0) || loading) return
      loading = true
      try {
        const response = await client.get<WebsiteSettingsResponse>('/site/settings')
        if (cancelled || response.data.version === version) return
        const defaults = emptyWebsiteSettings()
        const next = { ...defaults, ...response.data.settings,
          gallery: { ...defaults.gallery, ...response.data.settings.gallery },
        }
        version = response.data.version
        applyCopy(next)
        setSettings(next)
      } catch { /* Built-in content remains available if settings cannot load. */ }
      finally { loading = false }
    }
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 60_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return <WebsiteContext.Provider value={settings}>{children}</WebsiteContext.Provider>
}

export const useWebsiteSettings = () => useContext(WebsiteContext)
export function useWebsiteImage(key: string, fallback: string) {
  return useWebsiteSettings().images[key] || fallback
}
