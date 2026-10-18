'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { localizedValue } from '../../../../packages/website-settings/src'
import { publicWebsiteResources } from '../../../../packages/website-settings/src/drResources'
import { useWebsiteSettings } from './WebsiteSettingsProvider'

const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export default function WebsiteResources() {
  const { t, i18n } = useTranslation('blog')
  const settings = useWebsiteSettings()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const resources = useMemo(() => publicWebsiteResources(settings), [settings])
  const categories = useMemo(() => [...new Map(resources.map(resource => [resource.category.en || resource.category.es, resource.category] as const)).entries()]
    .sort((a, b) => localizedValue(a[1], i18n.language).localeCompare(localizedValue(b[1], i18n.language), i18n.language)), [resources, i18n.language])
  const activeCategory = categories.some(([key]) => key === category) ? category : ''
  const needle = searchable(query.trim())
  const shown = resources.filter(resource => (!activeCategory || (resource.category.en || resource.category.es) === activeCategory)
    && (!needle || searchable([resource.title.en, resource.title.es, resource.description.en, resource.description.es,
      resource.category.en, resource.category.es].join(' ')).includes(needle)))

  return (
    <section className="max-w-310 mx-auto px-4 sm:px-7 py-10" aria-labelledby="website-resources-heading">
      <h2 id="website-resources-heading" className="text-2xl font-bold text-ink mb-2 scroll-mt-24">{t('custom_resources')}</h2>
      <p className="text-sm text-ink2 mb-5 max-w-3xl">{t('resource_library.intro')}</p>
      <div className="grid sm:grid-cols-[2fr_1fr] gap-3 mb-4">
        <div>
          <label htmlFor="website-resource-search" className="block text-sm font-semibold text-ink mb-1">{t('resource_library.search')}</label>
          <input id="website-resource-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder={t('resource_library.search_placeholder')} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus-visible:outline-coral" />
        </div>
        <div>
          <label htmlFor="website-resource-category" className="block text-sm font-semibold text-ink mb-1">{t('resource_library.category')}</label>
          <select id="website-resource-category" value={activeCategory} onChange={event => setCategory(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink focus-visible:outline-coral">
            <option value="">{t('resource_library.all_categories')}</option>
            {categories.map(([key, label]) => <option key={key} value={key}>{localizedValue(label, i18n.language)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <p className="text-sm text-ink2" role="status" aria-live="polite">{t('resource_library.count', { count: shown.length, total: resources.length })}</p>
        {query || activeCategory ? <button type="button" onClick={() => { setQuery(''); setCategory('') }} className="text-sm font-semibold text-coral underline">{t('resource_library.clear')}</button> : null}
      </div>
      {!shown.length ? <p className="rounded-2xl border border-line p-6 text-sm text-ink2">{resources.length ? t('resource_library.no_matches') : t('resource_library.empty')}</p> : null}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {shown.map(resource => (
          <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer"
            className="block rounded-2xl border border-line p-5 hover:border-coral focus-visible:outline-coral">
            <p className="text-xs font-bold uppercase tracking-wide text-coral">{localizedValue(resource.category, i18n.language)}</p>
            <h3 className="font-bold text-lg text-ink mt-2">{localizedValue(resource.title, i18n.language)}</h3>
            <p className="text-sm text-ink2 mt-2">{localizedValue(resource.description, i18n.language)}</p>
            <span className="block text-sm font-semibold text-coral mt-4">{t('open_resource')} ↗</span>
          </a>
        ))}
      </div>
      <p className="text-xs text-ink2 mt-5 leading-relaxed">{t('resource_library.external_note')}</p>
    </section>
  )
}
