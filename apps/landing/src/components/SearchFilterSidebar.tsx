'use client'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronDown } from 'lucide-react'
import { PRICE_MAX } from '../data/searchData'
import { groupLocations, normalizeLocation, type SearchLocationOption } from '../data/searchLocations'
import { useWebsiteSettings } from './WebsiteSettingsProvider'
import { localizedValue } from '../../../../packages/website-settings/src'

const TYPES = ['All', 'Villa', 'Apartment', 'Condo', 'Land', 'Commercial']

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0 mb-5.5">
      <legend className="text-2.75 font-bold tracking-widest uppercase text-dim mb-2.5">{label}</legend>
      {children}
    </fieldset>
  )
}

function Chip({ active, onClick, children, tone }: {
  active: boolean
  onClick: () => void
  children: ReactNode
  tone?: 'coral' | 'brand'
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`font-sans text-[12.5px] cursor-pointer min-h-10 py-1.5 px-3 rounded-full mr-1.25 mb-1.25 border transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
        active
          ? tone === 'coral' ? 'bg-coral text-paper border-coral font-bold'
          : tone === 'brand' ? 'bg-brand text-paper border-brand font-bold'
          : 'bg-ink text-paper border-ink font-bold'
          : 'bg-paper text-ink2 border-line font-medium'
      }`}>{children}</button>
  )
}

function AreaCheckbox({ checked, partial, onChange, children }: {
  checked: boolean
  partial: boolean
  onChange: () => void
  children: ReactNode
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (inputRef.current) inputRef.current.indeterminate = partial }, [partial])
  return (
    <label className="flex items-center gap-2 min-h-10 cursor-pointer text-xs text-ink2">
      <input ref={inputRef} type="checkbox" checked={checked} onChange={onChange}
        aria-checked={partial ? 'mixed' : checked} className="w-4 h-4 shrink-0 accent-coral" />
      <span>{children}</span>
    </label>
  )
}

export interface FilterSidebarProps {
  types: string[]
  purpose: 'sale' | 'rent' | 'investment'
  rentalPeriod: 'month' | 'day'
  minPrice: number
  maxPrice: number
  beds: string
  locations: string[]
  locationOptions: SearchLocationOption[]
  minROI: number
  amenities: Set<string>
  setTypes: (v: string[]) => void
  setPurpose: (v: 'sale' | 'rent' | 'investment') => void
  setRentalPeriod: (v: 'month' | 'day') => void
  setMinPrice: (v: number) => void
  setMaxPrice: (v: number) => void
  setBeds: (v: string) => void
  setLocations: (v: string[]) => void
  setMinROI: (v: number) => void
  setAmenities: (v: Set<string>) => void
  allAmenities: string[]
  chips: { label: string; clear: () => void }[]
  resultsCount: number
  clearAll: () => void
  mobile?: boolean
  onClose?: () => void
}

export function SearchFilterSidebar(props: FilterSidebarProps) {
  const { t, i18n } = useTranslation('search')
  const { searchAreas } = useWebsiteSettings()
  const {
    types, purpose, minPrice, maxPrice, beds, locations, locationOptions, minROI, amenities, rentalPeriod,
    setTypes, setPurpose, setMinPrice, setMaxPrice, setBeds, setLocations, setMinROI, setAmenities,
    allAmenities, chips, resultsCount, clearAll, setRentalPeriod, mobile = false, onClose,
  } = props
  const id = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const [locationSearch, setLocationSearch] = useState('')
  const locationGroups = groupLocations([...locationOptions, ...locations.map(value => ({ value, count: 0 }))], searchAreas)
  const groupLabel = (group: typeof locationGroups[number]) => group.label
    ? localizedValue(group.label, i18n.language) : t(`locations.areas.${group.key}`)
  const selected = new Set(locations.map(normalizeLocation))
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([
    'north_coast', 'east',
    ...locationGroups.filter(group => group.options.some(option => selected.has(normalizeLocation(option.value)))).map(group => group.key),
  ]))
  const query = normalizeLocation(locationSearch)
  const visibleGroups = locationGroups.map(group => ({
    ...group,
    visible: !query || normalizeLocation(groupLabel(group)).includes(query)
      ? group.options : group.options.filter(option => normalizeLocation(option.value).includes(query)),
  })).filter(group => group.visible.length > 0)

  useEffect(() => {
    if (!mobile) return
    const desktop = window.matchMedia('(min-width: 1024px)')
    if (desktop.matches) { onCloseRef.current?.(); return }
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    closeRef.current?.focus()
    const focusable = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(element => element.getClientRects().length > 0)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
      } else if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0]
        const last = elements[elements.length - 1]
        if (!first) { event.preventDefault(); return }
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault(); last.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
          event.preventDefault(); first.focus()
        }
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) closeRef.current?.focus()
    }
    const onViewportChange = (event: MediaQueryListEvent) => { if (event.matches) onCloseRef.current?.() }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    desktop.addEventListener('change', onViewportChange)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
      desktop.removeEventListener('change', onViewportChange)
      if (previouslyFocused?.isConnected) previouslyFocused.focus()
    }
  }, [mobile])

  const toggleLocation = (value: string) => {
    const key = normalizeLocation(value)
    setLocations(selected.has(key)
      ? locations.filter(location => normalizeLocation(location) !== key)
      : [...locations, value])
  }

  const clearFilters = () => { setLocationSearch(''); clearAll() }
  const filterContent = (
    <>
      <FilterGroup label={t('sidebar.property_type')}>
        <p className="text-xs text-dim mt-0 mb-2">{t('sidebar.type_help')}</p>
        {TYPES.map(type => (
          <Chip key={type} active={type === 'All' ? types.length === 0 : types.includes(type)}
            onClick={() => setTypes(type === 'All' ? [] : types.includes(type) ? types.filter(value => value !== type) : [...types, type])}>
            {t(`sidebar.type_${type.toLowerCase()}`)}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label={t('sidebar.purpose')}>
        {(['sale', 'rent', 'investment'] as const).map(value => (
          <Chip key={value} active={purpose === value} onClick={() => setPurpose(value)} tone="coral">
            {value === 'sale' ? t('sidebar.for_sale') : value === 'rent' ? t('sidebar.for_rent') : t('sidebar.investment')}
          </Chip>
        ))}
      </FilterGroup>

      {purpose === 'rent' && (
        <FilterGroup label={t('sidebar.rental_period')}>
          {(['month', 'day'] as const).map(period => (
            <Chip key={period} active={rentalPeriod === period} onClick={() => setRentalPeriod(period)} tone="coral">
              {t(`sidebar.rental_${period}`)}
            </Chip>
          ))}
        </FilterGroup>
      )}

      <FilterGroup label={t('sidebar.price_range')}>
        <p className="text-xs text-dim mb-2">{t(purpose === 'rent' ? `sidebar.budget_${rentalPeriod}` : 'sidebar.budget_sale')}</p>
        <div className="flex items-end gap-2">
          <label className="flex-1 min-w-0 text-xs text-dim">
            <span className="block mb-1">{t('sidebar.min_price')}</span>
            <input type="text" inputMode="numeric" value={minPrice ? minPrice.toLocaleString() : ''} placeholder={t('sidebar.min_price')}
              onChange={event => setMinPrice(+event.target.value.replace(/[^0-9]/g, '') || 0)}
              className="w-full min-w-0 py-2 px-2.5 rounded-md border border-line text-3.25 font-sans text-ink focus-visible:outline-coral" />
          </label>
          <label className="flex-1 min-w-0 text-xs text-dim">
            <span className="block mb-1">{t('sidebar.max_price')}</span>
            <input type="text" inputMode="numeric" value={maxPrice > 0 ? maxPrice.toLocaleString() : ''} placeholder={t('sidebar.max_price')}
              onChange={event => setMaxPrice(+event.target.value.replace(/[^0-9]/g, '') || 0)}
              className="w-full min-w-0 py-2 px-2.5 rounded-md border border-line text-3.25 font-sans text-ink focus-visible:outline-coral" />
          </label>
        </div>
        <input type="range" aria-label={t('sidebar.max_price')} min={0} max={PRICE_MAX} step={50_000} value={Math.min(maxPrice || PRICE_MAX, PRICE_MAX)}
          onChange={event => setMaxPrice(+event.target.value === PRICE_MAX ? 0 : +event.target.value)} className="w-full mt-2 accent-coral" />
        <p className="text-[11px] text-dim leading-relaxed my-2">{t('sidebar.exchange_note')}</p>
        <div className="flex justify-between text-[10.5px] text-dim">
          <span>{t('sidebar.price_zero')}</span><span>{t('sidebar.price_top')}</span>
        </div>
      </FilterGroup>

      <FilterGroup label={t('sidebar.bedrooms')}>
        {['any', '1', '2', '3', '4', '5'].map(value => (
          <Chip key={value} active={beds === value} onClick={() => setBeds(value)}>
            {value === 'any' ? t('sidebar.any') : t('sidebar.bedroom_min', { count: Number(value) })}
          </Chip>
        ))}
      </FilterGroup>

      <FilterGroup label={t('locations.heading')}>
        <p id={`${id}-location-help`} className="text-xs text-dim mt-0 mb-2 leading-relaxed">{t('locations.help')}</p>
        <label htmlFor={`${id}-location-search`} className="block text-xs font-semibold text-ink2 mb-1">{t('locations.search_label')}</label>
        <input id={`${id}-location-search`} type="search" value={locationSearch} autoComplete="off"
          aria-describedby={`${id}-location-help`} placeholder={t('locations.search_placeholder')}
          onChange={event => setLocationSearch(event.target.value)}
          className="w-full min-w-0 rounded-md border border-line py-2.5 px-2.5 text-3.25 text-ink font-sans focus-visible:outline-coral" />
        {locations.length > 0 && (
          <div className="flex justify-between items-center gap-2 text-xs my-2">
            <span className="text-dim">{t('locations.selected', { count: locations.length })}</span>
            <button type="button" onClick={() => setLocations([])} className="min-h-10 bg-transparent border-0 text-coral font-semibold cursor-pointer">{t('locations.clear')}</button>
          </div>
        )}
        <div className="mt-2 space-y-2">
          {visibleGroups.map(group => {
            const selectedCount = group.options.filter(option => selected.has(normalizeLocation(option.value))).length
            const checked = selectedCount === group.options.length
            const isExpanded = !!query || expanded.has(group.key)
            return (
              <div key={group.key} className="min-w-0 border border-line-soft rounded-lg px-2.5">
                <button type="button" aria-expanded={isExpanded} aria-controls={`${id}-area-${group.key}`}
                  onClick={() => setExpanded(previous => {
                    const next = new Set(previous)
                    next.has(group.key) ? next.delete(group.key) : next.add(group.key)
                    return next
                  })}
                  className="flex items-center justify-between gap-2 min-h-11 w-full text-left font-semibold text-3.25 text-ink bg-transparent border-0 p-0 cursor-pointer">
                  <span>{groupLabel(group)}</span>
                  <ChevronDown size={15} aria-hidden="true" className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                <AreaCheckbox checked={checked} partial={selectedCount > 0 && !checked} onChange={() => {
                  const groupKeys = new Set(group.options.map(option => normalizeLocation(option.value)))
                  setLocations(checked ? locations.filter(value => !groupKeys.has(normalizeLocation(value)))
                    : [...locations.filter(value => !groupKeys.has(normalizeLocation(value))), ...group.options.map(option => option.value)])
                  setExpanded(previous => new Set(previous).add(group.key))
                }}>
                      {t('locations.select_area', { area: groupLabel(group) })}
                </AreaCheckbox>
                <div id={`${id}-area-${group.key}`} hidden={!isExpanded} className="pb-2 border-t border-line-soft">
                  {group.visible.map(option => (
                    <label key={option.value} className="flex items-center gap-2 min-h-10 py-1 text-[12.5px] text-ink2 cursor-pointer">
                      <input type="checkbox" checked={selected.has(normalizeLocation(option.value))} onChange={() => toggleLocation(option.value)}
                        className="w-4 h-4 shrink-0 accent-coral" />
                      <span className="break-words min-w-0">{option.value}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          {visibleGroups.length === 0 && <p role="status" className="text-xs text-dim">{t('locations.no_matches')}</p>}
        </div>
      </FilterGroup>

      <FilterGroup label={t('sidebar.amenities')}>
        <p className="text-xs text-dim mt-0 mb-2">{t('sidebar.amenities_help')}</p>
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-1.5">
          {allAmenities.map(amenity => {
            const checked = amenities.has(amenity)
            return (
              <label key={amenity} className="flex items-center gap-1.75 min-h-10 text-[12.5px] text-ink2 cursor-pointer py-0.75">
                <input type="checkbox" checked={checked} onChange={() => {
                  const next = new Set(amenities)
                  checked ? next.delete(amenity) : next.add(amenity)
                  setAmenities(next)
                }} className="accent-coral w-3.5 h-3.5 shrink-0" />
                <span>{t(`amenities.${amenity}`, { defaultValue: amenity })}</span>
              </label>
            )
          })}
        </div>
      </FilterGroup>

      <FilterGroup label={t('sidebar.investment_filters')}>
        {[6, 8].map(value => (
          <Chip key={value} active={minROI === value} onClick={() => setMinROI(minROI === value ? 0 : value)} tone="brand">
            {t('chip_roi', { roi: value })}
          </Chip>
        ))}
      </FilterGroup>
    </>
  )

  if (mobile) {
    return (
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}
        className="fixed inset-0 z-50 flex flex-col bg-paper lg:hidden h-dvh">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line-soft shrink-0">
          <h2 id={`${id}-title`} className="font-sans text-4.5 font-bold text-ink m-0">{t('filters')}</h2>
          <div className="flex items-center gap-2">
            {chips.length > 0 && <span className="text-2.5 font-bold py-0.75 px-2 rounded-full bg-coral text-white">{chips.length}</span>}
            <button ref={closeRef} type="button" onClick={onClose} aria-label={t('sidebar.close')}
              className="min-w-11 min-h-11 p-1.5 bg-transparent border-none cursor-pointer text-ink flex items-center justify-center">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-4">{filterContent}</div>
        <div className="shrink-0 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line-soft flex flex-col gap-2.5">
          <button type="button" onClick={clearFilters}
            className="w-full min-h-11 py-2.5 px-3.5 rounded-lg bg-transparent text-dim border border-line font-sans text-3.25 font-semibold cursor-pointer">
            {t('sidebar.clear_all_filters')}
          </button>
          <button type="button" onClick={onClose}
            className="w-full min-h-11 py-2.5 px-3.5 rounded-lg bg-coral text-white border-none font-sans text-3.25 font-semibold cursor-pointer">
            {t('sidebar.show_results', { count: resultsCount })}
          </button>
        </div>
      </div>
    )
  }

  return (
    <aside aria-labelledby={`${id}-title`} className="hidden lg:block self-start sticky top-22.5 max-h-[calc(100vh-110px)] overflow-y-auto bg-paper border border-line-soft rounded-2xl p-4.5">
      <div className="flex items-center justify-between mb-4.5 pb-3 border-b border-line-soft">
        <h2 id={`${id}-title`} className="font-sans text-4.5 font-bold text-ink m-0">{t('filters')}</h2>
        {chips.length > 0 && <span className="text-2.5 font-bold py-0.75 px-2 rounded-full bg-coral text-white">{chips.length}</span>}
      </div>
      {filterContent}
      <p className="text-xs text-dim">{t('sidebar.updates_automatically')}</p>
      <button type="button" onClick={clearFilters}
        className="w-full min-h-11 mt-2 py-2.5 px-3.5 rounded-lg bg-transparent text-dim border border-line font-sans text-3.25 font-semibold cursor-pointer">
        {t('sidebar.clear_all_filters')}
      </button>
    </aside>
  )
}
