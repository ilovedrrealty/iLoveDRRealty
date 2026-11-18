import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { DirectoryLocationStatus, DirectoryMapSummary } from '../../api/directoryMaps'
import geography from '../../data/natural-earth-countries-110m-v5.1.2.json'
import { countryPath, directoryMapViews, mapPoint, type CountryGeometry } from '../../lib/directoryMapGeometry'
import { professionalButton, professionalPrimary } from './ProfessionalFields'

const countries = geography.features.map(feature => ({ ...feature.properties,
  path: countryPath(feature.geometry as CountryGeometry),
})).filter(country => country.path)

type Props = {
  summary: DirectoryMapSummary
  selectedArea: string
  locationStatus: DirectoryLocationStatus
  onArea: (key: string) => void
  onLocationStatus: (status: DirectoryLocationStatus) => void
  onClear: () => void
}

export function DirectoryAreaMap({ summary, selectedArea, locationStatus, onArea, onLocationStatus, onClear }: Props) {
  const { t } = useTranslation('professionals', { keyPrefix: 'directory_map' })
  const titleId = useId()
  const helpId = useId()
  const [view, setView] = useState<'dominican_republic' | 'caribbean'>('dominican_republic')
  const bounds = directoryMapViews[view]
  const selected = summary.areas.find(area => area.area_key === selectedArea)
  return <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-white p-4 sm:p-5" aria-labelledby={titleId} aria-describedby={helpId}>
    <h2 id={titleId} className="text-lg font-bold text-ink">{t('title')}</h2>
    <p id={helpId} className="text-sm leading-relaxed text-ink2">{t('help')}</p>
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('location_filter')}>
      {(['all', 'mapped', 'unmapped'] as const).map(status => <button type="button" key={status}
        className={locationStatus === status && !selectedArea ? professionalPrimary : professionalButton}
        aria-pressed={locationStatus === status && !selectedArea} onClick={() => onLocationStatus(status)}>
        {t(`counts.${status}`, { count: status === 'all' ? summary.total : status === 'mapped' ? summary.mapped_total : summary.unmapped_total })}
      </button>)}
      <button type="button" className={professionalButton} onClick={onClear}>{t('clear_all')}</button>
    </div>
    <p className="text-xs text-dim">{t('scope_help')}</p>
    {selectedArea && <p role="status" className="flex flex-wrap items-center gap-2 text-sm text-ink">
      <span>{t('selected', { area: selected?.label ?? selectedArea })}</span>
      <button type="button" className={professionalButton} onClick={() => onArea('')}>{t('clear_area')}</button>
    </p>}
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('map_view')}>
      {(['dominican_republic', 'caribbean'] as const).map(value => <button type="button" key={value}
        className={professionalButton} aria-pressed={view === value} onClick={() => setView(value)}>{t(`views.${value}`)}</button>)}
    </div>
    <div className="relative isolate w-full rounded-xl border border-line bg-sky-50" style={{ aspectRatio: `${bounds.east - bounds.west} / ${bounds.north - bounds.south}` }}>
      <svg className="absolute inset-0 h-full w-full rounded-xl" role="img" aria-label={t('geography')}
        viewBox={`${bounds.west} ${-bounds.north} ${bounds.east - bounds.west} ${bounds.north - bounds.south}`}>
        {countries.map(country => <path key={country.code} d={country.path} fill={country.code === 'DOM' ? '#d6e9cf' : '#ebe7df'}
          stroke="#8c9986" strokeWidth="0.012" fillRule="evenodd"><title>{country.name}</title></path>)}
        <text x="-70.5" y="-18.75" textAnchor="middle" fontSize="0.12" fill="#334155">{t('country_labels.dominican_republic')}</text>
        <text x="-73.2" y="-18.9" textAnchor="middle" fontSize="0.14" fill="#475569">{t('country_labels.haiti')}</text>
        <text x="-66.5" y="-18.1" textAnchor="middle" fontSize="0.14" fill="#475569">{t('country_labels.puerto_rico')}</text>
      </svg>
      {summary.areas.map(area => {
        const point = mapPoint(area.latitude, area.longitude, bounds)
        return point ? <button key={area.area_key} type="button" title={t('area_button', { area: area.label, count: area.record_count })}
          aria-label={t('area_button', { area: area.label, count: area.record_count })} aria-pressed={selectedArea === area.area_key}
          className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          style={{ left: `${point.left}%`, top: `${point.top}%` }} onClick={() => onArea(area.area_key)}>
          <span className={`flex min-h-7 min-w-7 items-center justify-center rounded-full border-2 border-white px-1 text-xs font-bold shadow-sm ${selectedArea === area.area_key ? 'bg-ink text-white' : 'bg-coral text-white'}`}>{area.record_count}</span>
        </button> : null
      })}
    </div>
    {!summary.areas.length ? <p className="text-sm text-ink2">{t('no_references')}</p> : <>
      <p className="text-xs text-dim">{t('multiple_help')}</p>
      <ul className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label={t('area_choices')}>
        {summary.areas.map(area => <li key={area.area_key} className="min-w-0"><button type="button"
          className={`${selectedArea === area.area_key ? professionalPrimary : professionalButton} w-full min-w-0 !justify-start text-left [overflow-wrap:anywhere]`}
          aria-pressed={selectedArea === area.area_key} onClick={() => onArea(area.area_key)}>
          <span>{area.label} · {area.record_count}<span className="block text-xs font-normal">{t(`purposes.${area.purpose}`)}</span></span>
        </button></li>)}
      </ul>
    </>}
    <p className="text-xs leading-relaxed text-dim">{t('attribution')} <a className="underline" href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth v5.1.2</a>. {t('reference_source')}</p>
  </section>
}
