import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getSaleCatalog, getSaleOptions, type SalePage, type SaleOptions, type SaleProperty } from '../../api/saleCatalog'
import { readSaleQuery, saleDefaults, saleListingPath, saleQuery, SALE_PAGE_SIZE, type SaleFilters } from '../../lib/saleCatalog'
import { landingBaseUrl } from '../../lib/siteUrls'

const LANDING = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const field = 'mt-1.5 min-h-11 min-w-0 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink'
const button = 'inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40'

export function SalePropertyCard({ entry, detailsUrl }: { entry: SaleProperty; detailsUrl: string }) {
  const { t, i18n } = useTranslation('realtor', { keyPrefix: 'sale_catalog' })
  let price: string
  try { price = new Intl.NumberFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', { style: 'currency', currency: entry.currency, maximumFractionDigits: 2 }).format(entry.price) }
  catch { price = `${entry.currency} ${entry.price.toLocaleString()}` }
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-line bg-white">
    {entry.image ? <img src={entry.image} alt="" loading="lazy" className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-line-soft" aria-hidden="true" />}
    <div className="space-y-3 p-4">
      <h2 className="break-words text-lg font-bold text-ink">{entry.title}</h2>
      <p className="break-words text-sm text-ink2">{entry.location}</p>
      <p className="break-words text-xl font-bold text-sea">{price}</p>
      <p className="break-words text-sm text-ink2">{t(`types.${entry.type.toLowerCase()}`, { defaultValue: entry.type })}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink2">
        {entry.bedrooms !== null && <span>{t('beds_value', { count: entry.bedrooms })}</span>}
        {entry.bathrooms !== null && <span>{t('baths_value', { count: entry.bathrooms })}</span>}
        {entry.area_sqft !== null && <span>{t('area_value', { value: entry.area_sqft.toLocaleString() })}</span>}
      </div>
      <a href={detailsUrl} target="_blank" rel="noopener noreferrer" className={`${button} w-full !bg-sea !text-white`}>{t('view')}</a>
    </div>
  </article>
}

export function RealtorSaleProperties() {
  const { t } = useTranslation('realtor', { keyPrefix: 'sale_catalog' })
  const [params, setParams] = useSearchParams(), queryString = params.toString()
  const query = readSaleQuery(params)
  const [inputs, setInputs] = useState<SaleFilters>(() => query?.filters ?? saleDefaults)
  const [invalidInput, setInvalidInput] = useState(false), [retry, setRetry] = useState(0)
  const [read, setRead] = useState<{ key: string; page: SalePage | null; error: boolean } | null>(null)
  const [options, setOptions] = useState<SaleOptions | null>(null), [optionsError, setOptionsError] = useState(false), [optionsRetry, setOptionsRetry] = useState(0)
  const requestKey = JSON.stringify([query, retry])
  useEffect(() => { const next = readSaleQuery(new URLSearchParams(queryString)); setInputs(next?.filters ?? saleDefaults); setInvalidInput(false) }, [queryString])
  useEffect(() => {
    const controller = new AbortController(), [requested] = JSON.parse(requestKey) as [ReturnType<typeof readSaleQuery>, number]
    setRead(null)
    if (!requested) return () => controller.abort()
    getSaleCatalog(requested.filters, requested.page, controller.signal)
      .then(page => { if (!controller.signal.aborted) setRead({ key: requestKey, page, error: false }) })
      .catch(() => { if (!controller.signal.aborted) setRead({ key: requestKey, page: null, error: true }) })
    return () => controller.abort()
  }, [requestKey])
  useEffect(() => {
    const controller = new AbortController(); setOptions(null); setOptionsError(false)
    getSaleOptions(controller.signal).then(value => { if (!controller.signal.aborted) setOptions(value) })
      .catch(() => { if (!controller.signal.aborted) setOptionsError(true) })
    return () => controller.abort()
  }, [optionsRetry])
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const next = saleQuery({ ...inputs, region: inputs.region.trim(), type: inputs.type.trim() })
    setInvalidInput(!next)
    if (next) setParams(next)
  }
  function change(key: keyof SaleFilters, value: string) { setInputs(current => ({ ...current, [key]: value })); setInvalidInput(false) }
  function clear() { setInputs({ ...saleDefaults }); setInvalidInput(false); setParams(saleQuery(saleDefaults)!) }
  function paginate(page: number) { if (query) { const next = saleQuery(query.filters, page); if (next) setParams(next) } }
  const current = read?.key === requestKey ? read : null, page = current?.page
  const totalPages = page ? Math.max(1, Math.ceil(page.total / SALE_PAGE_SIZE)) : 1
  return <div className="min-w-0 space-y-5">
    <p className="max-w-4xl text-sm leading-relaxed text-ink2">{t('intro')}</p>
    <form onSubmit={apply} className="grid min-w-0 gap-4 rounded-2xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="min-w-0 text-sm font-semibold text-ink">{t('location')}<input type="search" value={inputs.region} maxLength={80} list="sale-catalog-locations" className={field} onChange={event => change('region', event.target.value)} /></label>
      <datalist id="sale-catalog-locations">{options?.locations.map(value => <option key={value} value={value} />)}</datalist>
      <label className="min-w-0 text-sm font-semibold text-ink">{t('type')}<select value={inputs.type} className={field} onChange={event => change('type', event.target.value)}><option value="">{t('any')}</option>
        {inputs.type && !options?.types.includes(inputs.type) && <option value={inputs.type}>{inputs.type}</option>}
        {options?.types.map(value => <option key={value} value={value}>{t(`types.${value.toLowerCase()}`, { defaultValue: value })}</option>)}</select></label>
      <label className="min-w-0 text-sm font-semibold text-ink">{t('beds')}<select value={inputs.beds} className={field} onChange={event => change('beds', event.target.value)}><option value="">{t('any')}</option>{Array.from({ length: 21 }, (_, number) => <option key={number} value={number}>{number}+</option>)}</select></label>
      {(['min_price', 'max_price', 'usd_to_dop'] as const).map(key => <label key={key} className="min-w-0 text-sm font-semibold text-ink">{t(key)}<input type="number" min={key === 'usd_to_dop' ? 1 : 0} max={key === 'usd_to_dop' ? 1000 : undefined} step={key === 'usd_to_dop' ? '0.0001' : '0.01'} value={inputs[key]} className={field} onChange={event => change(key, event.target.value)} /></label>)}
      <label className="min-w-0 text-sm font-semibold text-ink">{t('sort')}<select value={inputs.sort} className={field} onChange={event => change('sort', event.target.value)}>{['new', 'low', 'high'].map(value => <option key={value} value={value}>{t(`sort_${value}`)}</option>)}</select></label>
      <div className="flex flex-wrap items-end gap-2"><button type="submit" className={`${button} !bg-sea !text-white`}>{t('search')}</button><button type="button" className={button} onClick={clear}>{t('clear')}</button></div>
      <p className="text-xs leading-relaxed text-dim sm:col-span-2 lg:col-span-3">{t('price_note')}</p>
      {(invalidInput || !query) && <p role="alert" className="text-sm text-red-800 sm:col-span-2 lg:col-span-3">{t('invalid_filters')}</p>}
      {optionsError && <p role="status" className="text-sm text-ink2 sm:col-span-2 lg:col-span-3">{t('options_error')} <button type="button" className="min-h-11 underline" onClick={() => setOptionsRetry(value => value + 1)}>{t('retry')}</button></p>}
    </form>
    {!query ? null : !current ? <p role="status">{t('loading')}</p> : current.error || !page ? <div role="alert" className="space-y-3 rounded-xl border border-line bg-white p-4"><p>{t('error')}</p><button type="button" className={button} onClick={() => setRetry(value => value + 1)}>{t('retry')}</button></div> : <>
      <p role="status" className="text-sm text-ink2">{t('results', { count: page.total })}</p>
      {!page.items.length && <p className="rounded-xl border border-line bg-white p-5 text-sm text-ink2">{t('empty')}</p>}
      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{page.items.map(entry => <SalePropertyCard key={entry.id} entry={entry} detailsUrl={new URL(saleListingPath(entry.id)!, LANDING).href} />)}</div>
      {(page.total > SALE_PAGE_SIZE || page.page > 1) && <nav aria-label={t('pagination')} className="flex flex-wrap items-center gap-3">
        {page.page > totalPages && <button type="button" className={button} onClick={() => paginate(1)}>{t('first')}</button>}
        <button type="button" className={button} disabled={page.page <= 1} onClick={() => paginate(page.page - 1)}>{t('previous')}</button>
        <span className="text-sm text-ink2">{t('page', { page: page.page, total: totalPages })}</span>
        <button type="button" className={button} disabled={page.page >= totalPages} onClick={() => paginate(page.page + 1)}>{t('next')}</button>
      </nav>}
    </>}
  </div>
}
