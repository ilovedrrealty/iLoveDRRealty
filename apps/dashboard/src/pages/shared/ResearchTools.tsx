import { useEffect, useMemo, useState } from 'react'
import { isAxiosError } from 'axios'
import { ArrowUpRight, Calculator, CheckSquare, ExternalLink, MapPin, Printer, Ruler, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { localizedValue } from '../../../../../packages/website-settings/src'
import type { UserInfo } from '../../lib/auth'
import { getResearchTools } from '../../api/researchTools'
import { ALL_REGIONS } from '../../data/regions'
import { BUILT_IN_RESEARCH_TOOLS, CHECKLIST_ITEMS, convertArea, mergeResearchTools, type AreaUnit, type ResearchTool } from '../../data/researchTools'
import { landingBaseUrl } from '../../lib/siteUrls'

const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const FIELD = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-sea'
const CARD = 'rounded-2xl border border-line bg-paper p-5 research-tools-card'
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function AreaConverter() {
  const { t, i18n } = useTranslation('research_tools')
  const [amount, setAmount] = useState('100')
  const [unit, setUnit] = useState<AreaUnit>('m2')
  const numeric = amount.trim() === '' ? null : Number(amount)
  const valid = numeric != null && Number.isFinite(numeric) && numeric >= 0
  const formatter = new Intl.NumberFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', { maximumFractionDigits: 4 })
  return (
    <section className={CARD} aria-labelledby="area-converter-heading">
      <h2 id="area-converter-heading" className="text-[16px] font-bold text-ink flex items-center gap-2 m-0"><Ruler size={18} /> {t('area.title')}</h2>
      <p className="text-[12.5px] text-dim leading-relaxed mt-2 mb-4">{t('area.intro')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 research-no-print">
        <label className="text-[12px] font-semibold text-ink2">{t('area.amount')}<input type="number" min="0" step="any" value={amount} onChange={event => setAmount(event.target.value)} className={`${FIELD} mt-1.5`} /></label>
        <label className="text-[12px] font-semibold text-ink2">{t('area.from')}<select value={unit} onChange={event => setUnit(event.target.value as AreaUnit)} className={`${FIELD} mt-1.5`}>
          {(['m2', 'sqft', 'hectares'] as AreaUnit[]).map(value => <option key={value} value={value}>{t(`area.units.${value}`)}</option>)}
        </select></label>
      </div>
      {!valid && amount !== '' && <p className="text-[12px] text-red-700" role="status">{t('area.invalid')}</p>}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 mb-0" aria-live="polite">
        {(['m2', 'sqft', 'hectares'] as AreaUnit[]).map(value => {
          const converted = valid ? convertArea(numeric!, unit, value) : null
          return <div key={value} className="rounded-lg bg-paper2 p-3"><dt className="text-[11px] text-dim">{t(`area.units.${value}`)}</dt><dd className="m-0 mt-1 text-[17px] font-bold break-words">{converted == null ? '—' : formatter.format(converted)}</dd></div>
        })}
      </dl>
      <p className="text-[11.5px] text-dim mt-3 mb-0">{t('area.formula')}</p>
    </section>
  )
}

export function DueDiligenceChecklist() {
  const { t } = useTranslation('research_tools')
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const completed = CHECKLIST_ITEMS.filter(id => checks[id]).length
  return (
    <section className={CARD} aria-labelledby="due-diligence-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="due-diligence-heading" className="text-[16px] font-bold text-ink flex items-center gap-2 m-0"><CheckSquare size={18} /> {t('checklist.title')}</h2>
        <button onClick={() => window.print()} className="research-no-print inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-semibold cursor-pointer"><Printer size={14} />{t('checklist.print')}</button>
      </div>
      <p className="text-[12.5px] text-dim leading-relaxed mt-2 mb-3">{t('checklist.intro')}</p>
      <p className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12px] text-amber-900 leading-relaxed">{t('checklist.temporary')}</p>
      <p className="text-[12px] font-semibold text-ink2" aria-live="polite">{t('checklist.progress', { done: completed, total: CHECKLIST_ITEMS.length })}</p>
      <div className="flex flex-col divide-y divide-line">
        {CHECKLIST_ITEMS.map(id => (
          <div key={id} className="py-3 research-tools-card">
            <label className="flex items-start gap-2.5 text-[13px] font-semibold text-ink cursor-pointer">
              <input type="checkbox" checked={!!checks[id]} onChange={event => setChecks(previous => ({ ...previous, [id]: event.target.checked }))} className="mt-0.5 h-4 w-4 accent-sea shrink-0" />
              <span>{t(`checklist.items.${id}`)}</span>
            </label>
            <label className="block mt-2 ml-6.5 text-[11.5px] text-dim research-no-print">
              {t('checklist.note_label', { item: t(`checklist.items.${id}`) })}
              <textarea value={notes[id] ?? ''} onChange={event => setNotes(previous => ({ ...previous, [id]: event.target.value }))} maxLength={2000} rows={2} className={`${FIELD} mt-1 resize-y`} placeholder={t('checklist.note_placeholder')} />
            </label>
            {notes[id] && <p className="hidden print:block whitespace-pre-wrap text-[12px] ml-6.5">{notes[id]}</p>}
          </div>
        ))}
      </div>
      <p className="text-[11.5px] text-dim leading-relaxed mb-0">{t('checklist.limit')}</p>
    </section>
  )
}

export function ResearchTools({ user }: { user: UserInfo }) {
  const { t, i18n } = useTranslation('research_tools')
  const canUse = user.role === 'admin' || user.role === 'realtor'
  const [tools, setTools] = useState<ResearchTool[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable' | 'denied'>('loading')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [city, setCity] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setTools([])
    setStatus('loading')
    if (!canUse) {
      setStatus('denied')
      return () => controller.abort()
    }
    getResearchTools(controller.signal).then(configured => {
      if (controller.signal.aborted) return
      setTools(mergeResearchTools(configured))
      setStatus('ready')
    }).catch(error => {
      if (controller.signal.aborted) return
      if (isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
        setTools([])
        setStatus('denied')
      } else {
        // These built-ins are public official links, never a cached private config.
        setTools(BUILT_IN_RESEARCH_TOOLS)
        setStatus('unavailable')
      }
    })
    return () => controller.abort()
  }, [canUse, user.id, retry])
  const categories = useMemo(() => [...new Map(tools.map(tool => [tool.category.en, tool.category])).entries()], [tools])
  const activeCategory = categories.some(([key]) => key === category) ? category : 'all'
  const filtered = useMemo(() => tools.filter(tool => {
    if (activeCategory !== 'all' && tool.category.en !== activeCategory) return false
    const searchable = [tool.title.en, tool.title.es, tool.description.en, tool.description.es, tool.category.en, tool.category.es, tool.organization ?? ''].join(' ')
    return normalize(searchable).includes(normalize(query.trim()))
  }), [tools, query, activeCategory])
  if (!canUse || status === 'denied') return <section className={CARD} role="alert"><h2 className="text-[17px] font-bold">{t('access.title')}</h2><p className="text-[13px] text-ink2 leading-relaxed">{t('access.description')}</p></section>
  const searchUrl = new URL('/search/', LANDING_URL)
  if (city) searchUrl.searchParams.set('location', city)
  return (
    <div className="flex flex-col gap-5 research-tools-page">
      <style>{'@media print { aside, .research-no-print { display:none!important } main { margin-left:0!important } .research-tools-card { break-inside:avoid } }'}</style>
      <section className="rounded-2xl bg-nav p-5 sm:p-6 text-white">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/65 mt-0 mb-2">{t('eyebrow')}</p>
        <h2 className="text-[22px] font-bold mt-0 mb-2">{t('title')}</h2>
        <p className="text-[13px] leading-relaxed text-white/80 max-w-3xl m-0">{t('intro')}</p>
      </section>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className={CARD}>
          <h2 className="text-[16px] font-bold text-ink flex items-center gap-2 mt-0"><MapPin size={18} />{t('site_tools.title')}</h2>
          <p className="text-[12.5px] text-dim leading-relaxed">{t('site_tools.description')}</p>
          <label className="block text-[12px] font-semibold text-ink2 research-no-print">{t('site_tools.city')}
            <select value={city} onChange={event => setCity(event.target.value)} className={`${FIELD} mt-1.5`}><option value="">{t('site_tools.all_locations')}</option>{ALL_REGIONS.map(value => <option key={value} value={value}>{value}</option>)}</select>
          </label>
          <div className="flex flex-wrap gap-2 mt-4">
            <a href={searchUrl.toString()} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-sea px-3 py-2.5 text-[12px] font-semibold text-white no-underline"><MapPin size={14} />{t('site_tools.search')}<ArrowUpRight size={13} /></a>
            <a href={`${LANDING_URL}/calculator/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2.5 text-[12px] font-semibold text-ink no-underline"><Calculator size={14} />{t('site_tools.roi')}<ArrowUpRight size={13} /></a>
          </div>
        </section>
        <AreaConverter />
      </div>
      <section className={CARD} aria-labelledby="official-services-heading">
        <h2 id="official-services-heading" className="text-[17px] font-bold text-ink mt-0 mb-2">{t('directory.title')}</h2>
        <p className="text-[13px] text-ink2 leading-relaxed mt-0 mb-3">{t('directory.distinction')}</p>
        <p className="text-[12px] text-dim leading-relaxed mt-0 mb-4">{t('directory.external_note')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 research-no-print">
          <label className="text-[12px] font-semibold text-ink2"><span className="flex items-center gap-1.5"><Search size={13} />{t('directory.search')}</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} className={`${FIELD} mt-1.5`} placeholder={t('directory.search_placeholder')} /></label>
          <label className="text-[12px] font-semibold text-ink2">{t('directory.category')}<select value={activeCategory} onChange={event => setCategory(event.target.value)} className={`${FIELD} mt-1.5`}><option value="all">{t('directory.all_categories')}</option>{categories.map(([key, value]) => <option key={key} value={key}>{localizedValue(value, i18n.language)}</option>)}</select></label>
        </div>
        {status === 'loading' && <p role="status" className="text-[12px] text-dim mt-4">{t('directory.loading')}</p>}
        {status === 'unavailable' && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 mt-4"><p role="status" className="text-[12px] text-amber-900 mt-0">{t('directory.unavailable')}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="text-[12px] font-semibold text-amber-900 underline">{t('directory.retry')}</button></div>}
        {query || activeCategory !== 'all' ? <button type="button" onClick={() => { setQuery(''); setCategory('all') }} className="text-[12px] font-semibold text-sea underline mt-3">{t('directory.clear')}</button> : null}
        {status !== 'loading' && <p className="text-[12px] text-dim mt-4">{t('directory.count', { count: filtered.length })}</p>}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          {filtered.map(tool => (
            <article key={tool.id} className="research-tools-card rounded-xl border border-line p-4 min-w-0 flex flex-col">
              <span className="text-[10.5px] font-semibold text-sea uppercase tracking-wide">{localizedValue(tool.category, i18n.language)}</span>
              <h3 className="text-[15px] text-ink font-bold mt-2 mb-2">{localizedValue(tool.title, i18n.language)}</h3>
              <p className="text-[12.5px] text-ink2 leading-relaxed mt-0 mb-2">{localizedValue(tool.description, i18n.language)}</p>
              <p className="text-[11.5px] text-dim leading-relaxed mt-0 mb-3">{tool.notes ? localizedValue(tool.notes, i18n.language) : t('directory.configured_note')}</p>
              {tool.organization && <p className="text-[10.5px] text-dim mt-0 mb-3">{tool.organization} · {t('directory.checked', { date: tool.verifiedDate })}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-auto">
                <a href={tool.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-paper2 px-3 py-2 text-[12px] font-semibold text-ink no-underline">{t('directory.open')}<ExternalLink size={13} /></a>
                {tool.sourceUrl && <a href={tool.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[11.5px] text-sea underline">{t('directory.source')}</a>}
              </div>
            </article>
          ))}
        </div>
        {status !== 'loading' && filtered.length === 0 && <p className="text-[13px] text-dim py-5 text-center">{t('directory.empty')}</p>}
      </section>
      <DueDiligenceChecklist />
    </div>
  )
}
