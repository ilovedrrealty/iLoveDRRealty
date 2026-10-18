'use client'

import { useTranslation } from 'react-i18next'
import { localizedValue } from '../../../../packages/website-settings/src'
import { useWebsiteSettings } from './WebsiteSettingsProvider'

export default function WebsiteResources() {
  const { t, i18n } = useTranslation('blog')
  const settings = useWebsiteSettings()
  const resources = [...settings.resources, ...settings.realtorTools.filter(tool => tool.access === 'public')]
    .filter(resource => resource.enabled)
  if (!resources.length) return null
  return (
    <section className="max-w-310 mx-auto px-4 sm:px-7 py-10" aria-labelledby="website-resources-heading">
      <h2 id="website-resources-heading" className="text-2xl font-bold text-ink mb-4">{t('custom_resources')}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map(resource => (
          <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer"
            className="block rounded-2xl border border-line p-5 hover:border-coral focus-visible:outline-coral">
            <p className="text-xs font-bold uppercase tracking-wide text-coral">{localizedValue(resource.category, i18n.language)}</p>
            <h3 className="font-bold text-lg text-ink mt-2">{localizedValue(resource.title, i18n.language)}</h3>
            <p className="text-sm text-ink2 mt-2">{localizedValue(resource.description, i18n.language)}</p>
            <span className="block text-sm font-semibold text-coral mt-4">{t('open_resource')} ↗</span>
          </a>
        ))}
      </div>
    </section>
  )
}
