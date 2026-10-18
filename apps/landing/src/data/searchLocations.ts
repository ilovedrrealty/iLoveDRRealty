import { DR_PROVINCES, POPULAR_AREAS } from './searchData'
import type { LocalizedText, WebsiteArea } from '../../../../packages/website-settings/src'

export interface SearchLocationOption {
  value: string
  count: number
}

export type LocationGroupKey = 'north_coast' | 'samana' | 'east' | 'santo_domingo' | 'central' | 'south' | 'other'

export interface SearchLocationGroup {
  key: string
  label?: LocalizedText
  options: SearchLocationOption[]
}

export const normalizeLocation = (value: string) => value.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLowerCase()

// Browsing groups cover every location offered by the listing form. These are
// visitor-facing areas, not a replacement for the country's province boundaries.
export const LOCATION_GROUPS: { key: Exclude<LocationGroupKey, 'other'>; values: string[] }[] = [
  { key: 'north_coast', values: ['Puerto Plata', 'Sosúa', 'Cabarete', 'María Trinidad Sánchez', 'Espaillat', 'Monte Cristi'] },
  { key: 'samana', values: ['Samaná', 'Las Terrenas'] },
  { key: 'east', values: ['Punta Cana', 'Cap Cana', 'La Altagracia', 'La Romana', 'San Pedro de Macorís', 'El Seibo', 'Hato Mayor', 'Monte Plata'] },
  { key: 'santo_domingo', values: ['Santo Domingo', 'Distrito Nacional'] },
  { key: 'central', values: ['Santiago', 'Jarabacoa', 'La Vega', 'Monseñor Nouel', 'Duarte', 'Hermanas Mirabal', 'Sánchez Ramírez', 'Valverde', 'Dajabón', 'Santiago Rodríguez'] },
  { key: 'south', values: ['San Cristóbal', 'Peravia', 'Azua', 'Barahona', 'Pedernales', 'Bahoruco', 'Independencia', 'San José de Ocoa', 'San Juan', 'Elías Piña'] },
]

const canonicalLocations = new Map([...POPULAR_AREAS, ...DR_PROVINCES]
  .map(value => [normalizeLocation(value), value]))

/** Merge active inventory with the form choices, including destinations with no listings yet. */
export function groupLocations(options: SearchLocationOption[], areas: WebsiteArea[] = []): SearchLocationGroup[] {
  const merged = new Map<string, SearchLocationOption>([...canonicalLocations]
    .map(([key, value]) => [key, { value, count: 0 }]))

  for (const option of options) {
    const key = normalizeLocation(option.value)
    if (!key) continue
    const current = merged.get(key)
    merged.set(key, {
      value: canonicalLocations.get(key) ?? current?.value ?? option.value.trim(),
      count: (current?.count ?? 0) + (Number.isFinite(option.count) ? Math.max(0, option.count) : 0),
    })
  }

  const used = new Set<string>()
  const definitions = areas.length ? areas.map(area => ({ key: area.key, values: area.locations, label: area.label })) : LOCATION_GROUPS
  const groups: SearchLocationGroup[] = definitions.map(group => ({
    key: group.key,
    label: 'label' in group ? group.label : undefined,
    options: group.values.flatMap(value => {
      const key = normalizeLocation(value)
      const option = merged.get(key) ?? { value, count: 0 }
      used.add(key)
      return [option]
    }),
  }))
  const other = [...merged].filter(([key]) => !used.has(key)).map(([, option]) => option)
    .sort((a, b) => a.value.localeCompare(b.value, 'es', { sensitivity: 'base' }))
  if (other.length) groups.push({ key: 'other', options: other })
  return groups
}
