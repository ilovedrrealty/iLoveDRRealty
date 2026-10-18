'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import { emptyProfessionalOptions, professionalLabel, professionalOptionLabels, type ProfessionalOption, type ProfessionalOptions, type ProfessionalPage, type PublicProfessional } from '../../../../packages/professionals/src'
import { getProfessional, getProfessionalOptions, getProfessionals } from '../api/professionals'
import { ProfessionalDetails, ProfessionalPortrait } from '../components/ProfessionalDetails'

const LIMIT = 24
const button = 'rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-ink hover:border-coral focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-50 disabled:cursor-not-allowed'

function FilterChoices({ title, allLabel, options, values, change, max }: { title: string; allLabel: string; options: ProfessionalOption[]; values: string[]; change: (values: string[]) => void; max?: number }) {
  const { t, i18n } = useTranslation('professionals')
  return <details className="min-w-0 rounded-xl border border-line bg-white">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-ink">{title}<span className="block mt-1 text-xs text-dim font-normal">{values.length ? t('selected', { count: values.length }) : allLabel}</span></summary>
    <fieldset className="max-h-64 overflow-y-auto p-4 pt-1 space-y-2"><legend className="sr-only">{title}</legend>
      {max && <p className="text-xs text-dim mb-2">{t('filter_limit', { count: max })}</p>}
      {options.map(option => <label key={option.id} className="flex items-start gap-2 text-sm text-ink2"><input type="checkbox" className="accent-coral mt-1 shrink-0" checked={values.includes(option.id)} disabled={Boolean(max && values.length >= max && !values.includes(option.id))} onChange={event => change(event.target.checked ? [...values, option.id] : values.filter(value => value !== option.id))} /><span>{professionalLabel(option.label, i18n.language)}</span></label>)}
    </fieldset>
  </details>
}

export default function Professionals() {
  const { t, i18n } = useTranslation('professionals')
  const router = useRouter()
  const params = useSearchParams()
  const paramsString = params.toString()
  const filters = useMemo(() => {
    const parsed = new URLSearchParams(paramsString)
    const rawOffset = Number(parsed.get('offset') ?? 0)
    return {
      q: (parsed.get('q') ?? '').slice(0, 100), category: [...new Set(parsed.getAll('category'))], area: [...new Set(parsed.getAll('area'))],
      offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.min(9984, Math.floor(rawOffset / LIMIT) * LIMIT) : 0,
    }
  }, [paramsString])
  const filterKey = JSON.stringify(filters)
  const selectedId = params.get('profile') ?? ''
  const [query, setQuery] = useState(filters.q)
  const [categories, setCategories] = useState(filters.category)
  const [areas, setAreas] = useState(filters.area)
  const [options, setOptions] = useState<ProfessionalOptions>(emptyProfessionalOptions)
  const [page, setPage] = useState<ProfessionalPage<PublicProfessional>>({ items: [], total: 0, limit: LIMIT, offset: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState<PublicProfessional | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  useEffect(() => { setQuery(filters.q); setCategories(filters.category); setAreas(filters.area) }, [filterKey])
  useEffect(() => {
    const controller = new AbortController()
    const requested = JSON.parse(filterKey) as typeof filters
    setLoading(true); setError(false)
    Promise.all([getProfessionalOptions(controller.signal), getProfessionals({ ...requested, limit: LIMIT }, controller.signal)])
      .then(([nextOptions, next]) => { if (!controller.signal.aborted) { setOptions(nextOptions); setPage(next) } })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filterKey, refresh])
  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailError(false); return }
    const controller = new AbortController()
    setDetail(null); setDetailLoading(true); setDetailError(false)
    getProfessional(selectedId, controller.signal).then(next => { if (!controller.signal.aborted) setDetail(next) })
      .catch(() => { if (!controller.signal.aborted) setDetailError(true) })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selectedId])
  function navigate(next: URLSearchParams) { router.replace(`/professionals/${next.size ? `?${next}` : ''}`, { scroll: false }) }
  function apply() {
    const next = new URLSearchParams()
    if (query.trim()) next.set('q', query.trim())
    categories.forEach(id => next.append('category', id)); areas.forEach(id => next.append('area', id))
    navigate(next)
  }
  function open(id: string) { const next = new URLSearchParams(paramsString); next.set('profile', id); navigate(next) }
  function close() { const next = new URLSearchParams(paramsString); next.delete('profile'); navigate(next) }
  function paginate(offset: number) { const next = new URLSearchParams(paramsString); next.delete('profile'); offset ? next.set('offset', String(offset)) : next.delete('offset'); navigate(next) }

  return <div className="bg-paper min-h-screen">
    <header className="bg-ink text-white"><div className="max-w-310 mx-auto px-4 sm:px-7 py-12 sm:py-16">
      <p className="text-xs font-extrabold uppercase tracking-[.15em] text-gold">{t('eyebrow')}</p>
      <h1 className="mt-4 max-w-4xl text-3xl sm:text-5xl font-extrabold leading-tight">{t('title')}</h1>
      <p className="mt-5 max-w-3xl text-white/75 leading-relaxed">{t('intro')}</p>
      <Link href="/signup/?join=professional" className="inline-block mt-6 rounded-full bg-coral text-white px-6 py-3 text-sm font-bold focus-visible:outline-gold">{t('join')}</Link>
      <p className="mt-3 max-w-xl text-xs text-white/65">{t('join_intro')}</p>
    </div></header>
    <main className="max-w-310 mx-auto px-4 sm:px-7 py-8 sm:py-12 space-y-6 min-w-0">
      <form onSubmit={event => { event.preventDefault(); apply() }} className="rounded-2xl border border-line bg-paper2 p-4 sm:p-6 space-y-4">
        <label className="block text-sm font-bold text-ink"><span className="block mb-2">{t('search')}</span><input maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('search_placeholder')} className="w-full min-w-0 rounded-xl border border-line bg-white p-3 text-sm focus:outline-coral" /></label>
        <div className="grid sm:grid-cols-2 gap-3 items-start"><FilterChoices title={t('categories')} allLabel={t('all_services')} options={options.categories} values={categories} change={setCategories} max={8} /><FilterChoices title={t('areas')} allLabel={t('all_areas')} options={options.areas} values={areas} change={setAreas} /></div>
        <p className="text-xs text-dim">{t('filter_help')}</p>
        <div className="flex flex-wrap gap-3"><button type="submit" className={`${button} !bg-coral !text-white !border-coral`}>{t('apply')}</button><button type="button" className={button} onClick={() => { setQuery(''); setCategories([]); setAreas([]); navigate(new URLSearchParams()) }}>{t('clear')}</button></div>
      </form>
      {loading ? <p role="status" className="text-sm text-ink2">{t('loading')}</p> : error ? <div role="alert" className="rounded-xl border border-line p-5 space-y-3"><p>{t('error')}</p><button className={button} onClick={() => setRefresh(value => value + 1)}>{t('retry')}</button></div> : <>
        <p role="status" className="text-sm text-dim">{t('results', { count: page.total })}</p>
        {!page.items.length && <div className="rounded-2xl border border-line bg-white p-8"><h2 className="font-bold text-lg text-ink">{t('empty')}</h2><p className="text-sm text-ink2 mt-2">{t('empty_help')}</p></div>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{page.items.map(profile => {
          const name = profile.business_name || profile.contact_name
          return <article key={profile.id} className="min-w-0 rounded-2xl border border-line bg-white p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3"><ProfessionalPortrait photo={profile.photo_url} name={name} /><div className="min-w-0"><h2 className="text-xl font-bold text-ink break-words">{name}</h2><p className="text-xs font-semibold text-coral mt-2">{professionalOptionLabels(profile.category_ids, options.categories, i18n.language).join(' · ')}</p></div></div>
            <p className="text-xs text-dim">{professionalOptionLabels(profile.service_area_ids, options.areas, i18n.language).join(' · ')}</p>
            <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink2 break-words">{professionalLabel(profile.descriptions, i18n.language)}</p>
            <button type="button" className={`${button} mt-auto self-start`} onClick={() => open(profile.id)} aria-label={`${t('view')}: ${name}`}>{t('view')}</button>
          </article>
        })}</div>
        {page.total > LIMIT && <nav aria-label={t('browse')} className="flex flex-wrap items-center gap-3"><button className={button} disabled={!filters.offset} onClick={() => paginate(Math.max(0, filters.offset - LIMIT))}>{t('previous')}</button><span className="text-xs text-dim">{t('page', { page: Math.floor(filters.offset / LIMIT) + 1, pages: Math.max(1, Math.ceil(page.total / LIMIT)) })}</span><button className={button} disabled={filters.offset + LIMIT >= page.total || filters.offset + LIMIT > 9984} onClick={() => paginate(filters.offset + LIMIT)}>{t('next')}</button></nav>}
      </>}
      <p className="text-xs leading-relaxed text-dim">{t('review_note')}</p>
    </main>
    {selectedId && <ProfessionalDetails profile={detail} options={options} loading={detailLoading} unavailable={detailError} onClose={close} />}
  </div>
}
