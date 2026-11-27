import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { emptyProfessionalOptions, professionalLabel, professionalOptionLabels, professionalServiceLabels, type ProfessionalOptions, type ProfessionalPage, type PublicProfessional } from '../../../../../packages/professionals/src'
import { getProfessional, getProfessionalOptions, getProfessionals } from '../../api/professionals'
import { getProfessionalMap, type DirectoryMapSummary, type DirectoryLocationStatus } from '../../api/directoryMaps'
import { DirectoryAreaMap } from '../../components/shared/DirectoryAreaMap'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { ProfessionalPreview } from '../../components/shared/ProfessionalPreview'
import { ProfileShareActions } from '../../components/shared/ProfileShareActions'
import { ShareContactButton } from '../../components/shared/ShareContactDialog'
import { ProfessionalFilterChoices, professionalButton, professionalInput, professionalPrimary } from '../../components/shared/ProfessionalFields'
import { ProfessionalFacetSummary } from '../../components/shared/ProfessionalFacets'
import { landingBaseUrl } from '../../lib/siteUrls'
import { dashboardLoginHint } from '../../../../../packages/dashboard-links'

const LIMIT = 24
const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const emptyPage: ProfessionalPage<PublicProfessional> = { items: [], total: 0, limit: LIMIT, offset: 0 }

export default function ProfessionalDirectory() {
  const { t, i18n } = useTranslation('professionals')
  const { t: networkT } = useTranslation('property_network')
  const [params, setParams] = useSearchParams()
  const paramsString = params.toString()
  const filters = useMemo(() => {
    const parsed = new URLSearchParams(paramsString)
    const rawOffset = Number(parsed.get('offset') ?? 0)
    const location = parsed.get('location_status')
    return { q: (parsed.get('q') ?? '').slice(0, 100), language: (parsed.get('language') ?? '').slice(0, 40), category: [...new Set(parsed.getAll('category'))], area: [...new Set(parsed.getAll('area'))],
      provider_kind: [...new Set(parsed.getAll('provider_kind'))], property_class: [...new Set(parsed.getAll('property_class'))], work_scope: [...new Set(parsed.getAll('work_scope'))],
      map_area: (parsed.get('map_area') ?? '').slice(0, 100), location_status: (location === 'mapped' || location === 'unmapped' ? location : 'all') as DirectoryLocationStatus,
      offset: Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.min(9984, Math.floor(rawOffset / LIMIT) * LIMIT) : 0 }
  }, [paramsString])
  const filterKey = JSON.stringify(filters)
  const selectedId = params.get('profile') ?? ''
  const [query, setQuery] = useState(filters.q)
  const [categories, setCategories] = useState(filters.category)
  const [areas, setAreas] = useState(filters.area)
  const [language, setLanguage] = useState(filters.language)
  const [providerKinds, setProviderKinds] = useState(filters.provider_kind)
  const [propertyClasses, setPropertyClasses] = useState(filters.property_class)
  const [workScopes, setWorkScopes] = useState(filters.work_scope)
  const [options, setOptions] = useState<ProfessionalOptions>(emptyProfessionalOptions)
  const [page, setPage] = useState(emptyPage)
  const [map, setMap] = useState<DirectoryMapSummary | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const accessEpoch = useRef(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [authError, setAuthError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState<PublicProfessional | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState(false)

  useEffect(() => {
    const revalidate = () => { if (document.visibilityState === 'visible') setRefresh(value => value + 1) }
    window.addEventListener('focus', revalidate)
    document.addEventListener('visibilitychange', revalidate)
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate) }
  }, [])
  useEffect(() => {
    const requested = JSON.parse(filterKey) as typeof filters
    setQuery(requested.q); setCategories(requested.category); setAreas(requested.area); setLanguage(requested.language)
    setProviderKinds(requested.provider_kind); setPropertyClasses(requested.property_class); setWorkScopes(requested.work_scope)
  }, [filterKey])
  useEffect(() => {
    const controller = new AbortController()
    const epoch = accessEpoch.current
    const requested = JSON.parse(filterKey) as typeof filters
    setLoading(true); setError(false); setPage(emptyPage); setMap(null)
    Promise.all([getProfessionalOptions(controller.signal), getProfessionals({ ...requested,
      map_area: requested.map_area || undefined, location_status: requested.location_status === 'all' ? undefined : requested.location_status,
      language: requested.language || undefined, limit: LIMIT }, controller.signal), getProfessionalMap(requested, controller.signal)])
      .then(([nextOptions, next, nextMap]) => {
        if (next.total !== nextMap.total) throw new Error('Directory changed while loading')
        if (!controller.signal.aborted && epoch === accessEpoch.current) {
          setOptions(nextOptions); setPage(next); setMap(nextMap); setLoadedKey(filterKey); setAuthError(false)
        }
      })
      .catch(cause => {
        if (controller.signal.aborted || epoch !== accessEpoch.current) return
        setError(true); setPage(emptyPage); setMap(null); setDetail(null); setLoadedKey(filterKey)
        if (isAxiosError(cause) && [401, 403].includes(cause.response?.status ?? 0)) {
          accessEpoch.current++; setAuthError(true); setOptions(emptyProfessionalOptions)
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [filterKey, refresh])
  useEffect(() => {
    setDetail(null); setDetailError(false)
    if (!selectedId || authError) return
    const controller = new AbortController()
    const epoch = accessEpoch.current
    setDetailLoading(true)
    getProfessional(selectedId, controller.signal)
      .then(next => { if (!controller.signal.aborted && epoch === accessEpoch.current) setDetail(next) })
      .catch(cause => { if (!controller.signal.aborted && epoch === accessEpoch.current) { setDetailError(true); if (isAxiosError(cause) && [401, 403].includes(cause.response?.status ?? 0)) { accessEpoch.current++; setAuthError(true); setPage(emptyPage); setMap(null); setDetail(null); setOptions(emptyProfessionalOptions) } } })
      .finally(() => { if (!controller.signal.aborted) setDetailLoading(false) })
    return () => controller.abort()
  }, [selectedId, authError, filterKey, refresh])
  function apply(clear = false) {
    const next = new URLSearchParams(paramsString)
    for (const key of ['q', 'category', 'area', 'language', 'provider_kind', 'property_class', 'work_scope', 'offset', 'profile']) next.delete(key)
    if (clear) { next.delete('map_area'); next.delete('location_status') }
    if (!clear) { if (query.trim()) next.set('q', query.trim()); if (language) next.set('language', language); categories.forEach(id => next.append('category', id)); areas.forEach(id => next.append('area', id)) }
    if (!clear) { providerKinds.forEach(id => next.append('provider_kind', id)); propertyClasses.forEach(id => next.append('property_class', id)); workScopes.forEach(id => next.append('work_scope', id)) }
    setParams(next, { replace: true })
  }
  function select(id?: string) { const next = new URLSearchParams(paramsString); id ? next.set('profile', id) : next.delete('profile'); setParams(next, { replace: true }) }
  function paginate(offset: number) { const next = new URLSearchParams(paramsString); next.delete('profile'); offset ? next.set('offset', String(offset)) : next.delete('offset'); setParams(next, { replace: true }) }
  function chooseLocation(mapArea: string, status: DirectoryLocationStatus) {
    const next = new URLSearchParams(paramsString)
    for (const key of ['map_area', 'location_status', 'offset', 'profile']) next.delete(key)
    if (mapArea) next.set('map_area', mapArea)
    if (status !== 'all') next.set('location_status', status)
    setDetail(null); setParams(next, { replace: true })
  }
  return <div className="min-w-0 space-y-6">
    <header className="rounded-2xl bg-ink p-5 sm:p-7 text-white"><h1 className="text-2xl font-bold">{t('directory_search.title')}</h1><p className="mt-3 max-w-3xl text-sm text-white/75 leading-relaxed">{t('directory_search.intro')}</p>
      <div className="mt-4 flex flex-wrap gap-4"><a href="/professional-profile" className="text-sm font-bold text-gold underline">{t('directory_search.join')}</a>
        <a href="/property-network?tab=groups" className="text-sm font-bold text-gold underline">{networkT('groups.title')}</a></div>
    </header>
    <form onSubmit={event => { event.preventDefault(); apply() }} className="rounded-2xl border border-line bg-white p-4 sm:p-6 space-y-4">
      <label className="block text-sm font-bold text-ink"><span className="block mb-2">{t('directory_search.search')}</span><input maxLength={100} value={query} onChange={event => setQuery(event.target.value)} placeholder={t('directory_search.search_placeholder')} className={professionalInput} /></label>
      <div className="grid sm:grid-cols-2 gap-3 items-start"><ProfessionalFilterChoices title={t('categories')} options={options.categories} values={categories} change={setCategories} max={8} /><ProfessionalFilterChoices title={t('areas')} options={options.areas} values={areas} change={setAreas} max={20} /></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-start">
        <ProfessionalFilterChoices title={t('facets.provider_kinds')} options={options.provider_kinds ?? []} values={providerKinds} change={setProviderKinds} max={10} />
        <ProfessionalFilterChoices title={t('facets.property_classes')} options={options.property_classes ?? []} values={propertyClasses} change={setPropertyClasses} max={10} />
        <ProfessionalFilterChoices title={t('facets.work_scopes')} options={options.work_scopes ?? []} values={workScopes} change={setWorkScopes} max={12} />
      </div>
      <p className="text-xs text-dim">{t('facets.filter_help')}</p>
      <label className="block text-sm font-semibold text-ink"><span className="mb-2 block">{t('languages')}</span><select className={professionalInput} value={language} onChange={event => setLanguage(event.target.value)}><option value="">{t('directory_language_any')}</option>{options.languages.map(option => <option key={option.id} value={option.id}>{professionalLabel(option.label, i18n.language)}</option>)}</select></label>
      <p className="text-xs text-dim">{t('directory_search.filter_help')}</p>
      <div className="flex flex-wrap gap-3"><button type="submit" className={professionalPrimary}>{t('directory_search.apply')}</button><button type="button" className={professionalButton} onClick={() => { setQuery(''); setCategories([]); setAreas([]); setLanguage(''); setProviderKinds([]); setPropertyClasses([]); setWorkScopes([]); apply(true) }}>{t('directory_search.clear')}</button></div>
    </form>
    {authError ? <div role="alert" className="rounded-xl border border-line bg-white p-5 space-y-3"><p>{t('directory_search.auth_error')}</p><a className={professionalPrimary} href={`${LANDING_URL.replace(/\/$/, '')}/login/${dashboardLoginHint('professional-directory', params) ?? '?directory=professionals'}`}>{t('directory_search.login')}</a></div> : loading || loadedKey !== filterKey ? <p role="status" className="text-sm text-ink2">{t('directory_search.loading')}</p> : error ? <div role="alert" className="rounded-xl border border-line p-5 space-y-3"><p>{t('directory_search.error')}</p><button className={professionalButton} onClick={() => setRefresh(value => value + 1)}>{t('retry')}</button></div> : <>
      {map && <DirectoryAreaMap summary={map} selectedArea={filters.map_area} locationStatus={filters.location_status}
        onArea={key => chooseLocation(key, 'all')} onLocationStatus={status => chooseLocation('', status)} onClear={() => apply(true)} />}
      <p role="status" className="text-sm text-dim">{t('directory_search.results', { count: page.total })}</p>
      {!page.items.length && <div className="rounded-2xl border border-line bg-white p-6"><h2 className="font-bold text-lg text-ink">{t('directory_search.empty')}</h2><p className="text-sm text-ink2 mt-2">{t('directory_search.empty_help')}</p></div>}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">{page.items.map(profile => <article key={profile.id} className="min-w-0 rounded-2xl border border-line bg-white p-5 flex flex-col gap-4">
        <div className="flex gap-3 items-start">{profile.photo_url && <img src={profile.photo_url} alt="" loading="lazy" className="h-16 w-16 rounded-xl object-cover shrink-0" />}<h2 className="text-xl font-bold text-ink break-words">{profile.business_name || profile.contact_name}</h2></div>
        {profile.contact_name && profile.contact_name !== profile.business_name && <p className="text-sm text-ink2">{profile.contact_name}</p>}
        <p className="break-words text-xs font-semibold text-coral">{professionalServiceLabels(profile, options.categories, i18n.language).join(' · ')}</p>
        <p className="text-xs text-dim">{professionalOptionLabels(profile.service_area_ids, options.areas, i18n.language).join(' · ')}</p>
        <ProfessionalFacetSummary profile={profile} options={options} />
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-relaxed text-ink2 break-words">{professionalLabel(profile.descriptions, i18n.language)}</p>
        <button type="button" className={`${professionalButton} mt-auto self-start`} onClick={() => select(profile.id)} aria-label={`${t('directory_search.view')}: ${profile.business_name || profile.contact_name}`}>{t('directory_search.view')}</button>
      </article>)}</div>
      {page.total > LIMIT && <nav aria-label={t('directory_search.browse')} className="flex flex-wrap items-center gap-3"><button className={professionalButton} disabled={!filters.offset} onClick={() => paginate(Math.max(0, filters.offset - LIMIT))}>{t('directory_search.previous')}</button><span className="text-xs text-dim">{t('directory_search.page', { page: Math.floor(filters.offset / LIMIT) + 1, pages: Math.max(1, Math.ceil(page.total / LIMIT)) })}</span><button className={professionalButton} disabled={filters.offset + LIMIT >= page.total || filters.offset + LIMIT > 9984} onClick={() => paginate(filters.offset + LIMIT)}>{t('directory_search.next')}</button></nav>}
    </>}
    <p className="text-xs leading-relaxed text-dim">{t('directory_search.review_note')}</p>
    {selectedId && !authError && !loading && !error && loadedKey === filterKey && <ProfessionalDialog title={detail?.business_name || detail?.contact_name || t('directory_search.title')} closeLabel={t('directory_search.close')} onClose={() => select()}>
      {detailError ? <p role="alert">{t('directory_search.unavailable')}</p> : detailLoading || !detail || detail.id !== selectedId ? <p role="status">{t('directory_search.loading')}</p> : <div key={detail.id} className="space-y-4"><ProfessionalPreview profile={detail} options={options} />
        <ShareContactButton contact={{ name: detail.business_name || detail.contact_name, email: detail.public_email, phone: detail.public_phone }} />
        <ProfileShareActions kind="professional" identifier={detail.id} /></div>}
    </ProfessionalDialog>}
  </div>
}
