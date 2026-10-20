import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Calculator, ExternalLink, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/dashboard/shared'
import { getPublicResources } from '../../api/publicResources'
import { localizedValue, type WebsiteResource } from '../../../../../packages/website-settings/src'
import { landingBaseUrl } from '../../lib/siteUrls'

const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const QUICK_LINKS = [
  { key: 'buying', path: '/buying/', Icon: BookOpen },
  { key: 'calculator', path: '/calculator/', Icon: Calculator },
  { key: 'library', path: '/blog/#website-resources-heading', Icon: ExternalLink },
] as const
const searchable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()

export function Resources({ go }: { go: (view: string) => void }) {
  const { t, i18n } = useTranslation('buyer')
  const { t: tTools } = useTranslation('tool_hubs')
  const [resources, setResources] = useState<WebsiteResource[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setResources([])
    void getPublicResources(controller.signal).then(items => {
      if (controller.signal.aborted) return
      setResources(items)
      setState('ready')
    }).catch(() => {
      if (!controller.signal.aborted) setState('error')
    })
    return () => controller.abort()
  }, [retry])

  const categories = useMemo(() => [...new Map(resources.map(resource => [resource.category.en || resource.category.es, resource.category] as const)).entries()]
    .sort((a, b) => localizedValue(a[1], i18n.language).localeCompare(localizedValue(b[1], i18n.language), i18n.language)), [resources, i18n.language])
  const activeCategory = categories.some(([key]) => key === category) ? category : ''
  const needle = searchable(query.trim())
  const shown = resources.filter(resource => (!activeCategory || (resource.category.en || resource.category.es) === activeCategory)
    && (!needle || searchable([resource.title.en, resource.title.es, resource.description.en, resource.description.es,
      resource.category.en, resource.category.es].join(' ')).includes(needle)))

  return (
    <div className="space-y-5">
      <Card title={<><BookOpen size={16} />{t('resources_page.title')}</>}>
        <p className="text-sm text-ink2 mb-4">{t('resources_page.intro')}</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <button type="button" onClick={() => go('professional-directory')} className="block text-left rounded-xl border border-line bg-white p-4 hover:border-coral focus-visible:outline-coral cursor-pointer">
            <span className="flex items-center gap-2 font-semibold text-sm text-coral"><Users size={17} aria-hidden="true" />{t('resources_page.quick.professionals.title')} →</span>
            <span className="block text-xs text-ink2 mt-2">{t('resources_page.quick.professionals.description')}</span>
          </button>
          <button type="button" onClick={() => go('professional-profile')} className="block text-left rounded-xl border border-line bg-white p-4 hover:border-coral focus-visible:outline-coral cursor-pointer">
            <span className="flex items-center gap-2 font-semibold text-sm text-coral"><Users size={17} aria-hidden="true" />{tTools('join.title')} →</span>
            <span className="block text-xs text-ink2 mt-2">{tTools('join.description')}</span>
          </button>
          {QUICK_LINKS.map(({ key, path, Icon }) => (
            <a key={key} href={`${LANDING_URL}${path}`} target="_blank" rel="noopener noreferrer"
              className="block rounded-xl border border-line p-4 hover:border-coral focus-visible:outline-coral">
              <span className="flex items-center gap-2 font-semibold text-sm text-coral"><Icon size={17} aria-hidden="true" />{t(`resources_page.quick.${key}.title`)} ↗</span>
              <p className="text-xs text-ink2 mt-2">{t(`resources_page.quick.${key}.description`)}</p>
            </a>
          ))}
        </div>
      </Card>
      <Card title={t('resources_page.library_title')}>
        <p className="text-sm text-ink2 mb-4">{t('resources_page.library_intro')}</p>
        {state === 'loading' ? <p className="text-sm text-ink2" role="status">{t('resources_page.loading')}</p> : null}
        {state === 'error' ? <div className="rounded-xl border border-line p-4">
          <p className="text-sm text-ink2" role="alert">{t('resources_page.error')}</p>
          <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-3 text-sm font-semibold text-coral underline">{t('resources_page.retry')}</button>
        </div> : null}
        {state === 'ready' ? <>
          <div className="grid sm:grid-cols-[2fr_1fr] gap-3 mb-4">
            <div>
              <label htmlFor="dashboard-resource-search" className="block text-sm font-semibold text-ink mb-1">{t('resources_page.search')}</label>
              <input id="dashboard-resource-search" type="search" value={query} onChange={event => setQuery(event.target.value)}
                placeholder={t('resources_page.search_placeholder')} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-coral" />
            </div>
            <div>
              <label htmlFor="dashboard-resource-category" className="block text-sm font-semibold text-ink mb-1">{t('resources_page.category')}</label>
              <select id="dashboard-resource-category" value={activeCategory} onChange={event => setCategory(event.target.value)} className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink focus-visible:outline-coral">
                <option value="">{t('resources_page.all_categories')}</option>
                {categories.map(([key, label]) => <option key={key} value={key}>{localizedValue(label, i18n.language)}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <p className="text-sm text-ink2" role="status" aria-live="polite">{t('resources_page.count', { count: shown.length, total: resources.length })}</p>
            {query || activeCategory ? <button type="button" onClick={() => { setQuery(''); setCategory('') }} className="text-sm font-semibold text-coral underline">{t('resources_page.clear')}</button> : null}
          </div>
          {!shown.length ? <p className="text-sm text-ink2 rounded-xl border border-line p-4">{resources.length ? t('resources_page.no_matches') : t('resources_page.empty')}</p> : null}
          <div className="grid sm:grid-cols-2 gap-3">
            {shown.map(resource => <a key={resource.id} href={resource.url} target="_blank" rel="noopener noreferrer"
              className="block min-w-0 rounded-xl border border-line p-4 hover:border-coral focus-visible:outline-coral">
              <p className="text-xs font-bold uppercase tracking-wide text-coral">{localizedValue(resource.category, i18n.language)}</p>
              <h3 className="font-semibold text-ink mt-2">{localizedValue(resource.title, i18n.language)}</h3>
              <p className="text-sm text-ink2 mt-2">{localizedValue(resource.description, i18n.language)}</p>
              <span className="block text-sm font-semibold text-coral mt-3">{t('resources_page.open')} ↗</span>
            </a>)}
          </div>
        </> : null}
        <p className="text-xs text-ink2 mt-5 leading-relaxed">{t('resources_page.external_note')}</p>
      </Card>
    </div>
  )
}
