import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAdminListing, getAdminListings, type AdminListing } from '../../api/admin'
import { DEFAULT_GALLERY_PHOTOS, DEFAULT_REALTOR_TOOLS, WEBSITE_IMAGE_KEYS, WEBSITE_ROUTES, cloneSettings, groupLocations, normalizeLocation } from '../../data/websiteEditorDefaults'
import { EditorCard, LocalizedFields, OrderControls, PhotoField, TextField, VisibilityField, editorButton, editorInput, moved } from './WebsiteEditorFields'
import type { ChangeWebsiteDraft } from './WebsiteEditorCopy'
import type { RealtorTool, WebsiteResource, WebsiteSettings } from '../../../../../packages/website-settings/src'

interface PanelProps { draft: WebsiteSettings; change: ChangeWebsiteDraft }
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
function useDraftMutation(change: ChangeWebsiteDraft) {
  return (update: (next: WebsiteSettings) => void) => change(previous => {
    const next = cloneSettings(previous); update(next); return next
  })
}

export function WebsiteGalleryPanel({ draft, change, onBusy }: PanelProps & { onBusy: (value: boolean) => void }) {
  const { t } = useTranslation('website_editor')
  const mutate = useDraftMutation(change)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [found, setFound] = useState<AdminListing[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Record<string, AdminListing>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const idsKey = [...draft.gallery.ids].sort().join(',')
  useEffect(() => {
    let cancelled = false
    const ids = idsKey.split(',').filter(Boolean)
    Promise.allSettled(ids.map(id => getAdminListing(id))).then(results => {
      if (cancelled) return
      const records: Record<string, AdminListing> = {}
      for (const result of results) if (result.status === 'fulfilled') records[result.value.id] = result.value
      setSelected(records)
    })
    return () => { cancelled = true }
  }, [idsKey])
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true); setError('')
      getAdminListings({ status: 'active', q: query.trim() || undefined, page, pageSize: 12 })
        .then(result => { if (!cancelled) { setFound(result.items); setTotal(result.total) } })
        .catch(() => { if (!cancelled) setError(t('gallery.search_error')) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 300)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [query, page, t])
  return <div className="space-y-5">
    <EditorCard title={t('gallery.heading')}>
      <p className="text-sm text-dim leading-relaxed">{t('gallery.help')}</p>
      <label className="block text-sm font-medium text-ink2"><span className="block mb-1.5">{t('gallery.mode')}</span>
        <select className={editorInput} value={draft.gallery.mode} onChange={event => mutate(next => { next.gallery.mode = event.target.value as 'auto' | 'featured' })}>
          <option value="auto">{t('gallery.auto')}</option><option value="featured">{t('gallery.featured')}</option>
        </select>
      </label>
      <p className="text-xs text-dim">{t('gallery.deals_help')}</p>
    </EditorCard>
    {draft.gallery.ids.map((id, index) => {
      const listing = selected[id]
      const label = listing?.title ?? id
      const photo = draft.gallery.photos[id] ?? DEFAULT_GALLERY_PHOTOS[id] ?? listing?.images?.[0] ?? ''
      const photos = [...new Set([photo, ...(listing?.images ?? [])].filter(Boolean))]
      return <EditorCard key={id} title={`${index + 1}. ${label}`}>
        {listing && <p className="text-sm text-dim">{listing.location}</p>}
        {listing?.status !== 'active' && <p className="text-xs text-amber-800">{t('gallery.active_only')}</p>}
        <OrderControls name={label} index={index} total={draft.gallery.ids.length}
          onMove={direction => mutate(next => { next.gallery.ids = moved(next.gallery.ids, index, direction) })}
          onRemove={() => mutate(next => { next.gallery.ids = next.gallery.ids.filter(value => value !== id); delete next.gallery.photos[id] })} />
        {photos.length > 0 && <label className="block text-sm text-ink2"><span className="block mb-1.5">{t('gallery.existing_photo')}</span>
          <select className={editorInput} value={photo} onChange={event => mutate(next => { next.gallery.photos[id] = event.target.value })}>
            {photos.map((url, photoIndex) => <option key={url} value={url}>{t('gallery.photo_number', { count: photoIndex + 1 })}</option>)}
          </select>
        </label>}
        <PhotoField label={label} value={photo} onBusy={onBusy} onChange={url => mutate(next => { next.gallery.photos[id] = url })} />
      </EditorCard>
    })}
    {draft.gallery.ids.length === 0 && <p className="text-sm text-dim">{t('gallery.empty_default')}</p>}
    <EditorCard title={t('gallery.choose')}>
      <TextField label={t('gallery.search')} value={query} onChange={value => { setQuery(value); setPage(1) }} />
      <p role="status" className="text-xs text-dim">{loading ? t('loading') : t('gallery.matching', { count: total })}</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-3">{found.map(listing => <div key={listing.id} className="rounded-lg border border-line p-3 min-w-0">
        {listing.images[0] && <img src={listing.images[0]} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-24 rounded object-cover mb-2" />}
        <p className="text-sm font-semibold text-ink break-words">{listing.title}</p><p className="text-xs text-dim mb-2">{listing.location}</p>
        <button type="button" className={editorButton} disabled={!listing.images.length || draft.gallery.ids.includes(listing.id) || draft.gallery.ids.length >= 5}
          onClick={() => mutate(next => { next.gallery.ids.push(listing.id); next.gallery.photos[listing.id] = listing.images[0] })}>
          {draft.gallery.ids.includes(listing.id) ? t('gallery.selected') : t('gallery.add')}
        </button>
      </div>)}</div>
      <div className="flex flex-wrap gap-2"><button type="button" className={editorButton} disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>{t('actions.previous')}</button>
        <button type="button" className={editorButton} disabled={page * 12 >= total || loading} onClick={() => setPage(value => value + 1)}>{t('actions.next')}</button></div>
    </EditorCard>
    <EditorCard title={t('photos.heading')}>
      <p className="text-sm text-dim">{t('photos.help')}</p>
      <div className="space-y-6">{WEBSITE_IMAGE_KEYS.map(key => <PhotoField key={key} label={t(`images.${key}`)} value={draft.images[key] ?? ''} allowBlank onBusy={onBusy}
        onChange={url => mutate(next => { next.images[key] = url })} />)}</div>
    </EditorCard>
  </div>
}

export function WebsiteMenuPanel({ draft, change }: PanelProps) {
  const { t } = useTranslation('website_editor')
  const mutate = useDraftMutation(change)
  return <div className="space-y-4">
    <p className="text-sm text-dim">{t('menu.help')}</p>
    {draft.navigation.map((item, index) => <EditorCard key={index} title={item.label.en || t('menu.item')}>
      <LocalizedFields label={t('fields.menu_label')} value={item.label} maxLength={160} onChange={value => mutate(next => { next.navigation[index].label = value })} />
      <label className="block text-sm text-ink2"><span className="block mb-1.5">{t('menu.destination')}</span>
        <select className={editorInput} value={item.route} onChange={event => mutate(next => { next.navigation[index].route = event.target.value })}>
          {WEBSITE_ROUTES.map(route => <option key={route} value={route} disabled={draft.navigation.some((other, otherIndex) => otherIndex !== index && other.route === route)}>{t(`routes.${route}`)}</option>)}
        </select>
      </label>
      <VisibilityField value={item.enabled} onChange={value => mutate(next => { next.navigation[index].enabled = value })} />
      <OrderControls name={item.label.en} index={index} total={draft.navigation.length} canRemove={draft.navigation.length > 1}
        onMove={direction => mutate(next => { next.navigation = moved(next.navigation, index, direction) })}
        onRemove={() => mutate(next => { next.navigation.splice(index, 1) })} />
    </EditorCard>)}
    <button type="button" className={editorButton} disabled={draft.navigation.length >= WEBSITE_ROUTES.length} onClick={() => mutate(next => {
      const route = WEBSITE_ROUTES.find(value => !next.navigation.some(item => item.route === value))
      if (route) next.navigation.push({ route, label: { en: '', es: '' }, enabled: true })
    })}>{t('menu.add')}</button>
  </div>
}

export function WebsiteAreasPanel({ draft, change, locationOptions }: PanelProps & { locationOptions: { value: string; count: number }[] }) {
  const { t } = useTranslation('website_editor')
  const mutate = useDraftMutation(change)
  const [query, setQuery] = useState('')
  const all = groupLocations([...locationOptions, ...draft.searchAreas.flatMap(area => area.locations.map(value => ({ value, count: 0 })))]).flatMap(group => group.options)
  const matching = all.filter(option => normalizeLocation(option.value).includes(normalizeLocation(query)))
  return <div className="space-y-4">
    <p className="text-sm text-dim leading-relaxed">{t('areas.help')}</p>
    <TextField label={t('areas.search')} value={query} onChange={setQuery} />
    {draft.searchAreas.map((area, index) => <EditorCard key={area.key} title={area.label.en || t('areas.item')}>
      <LocalizedFields label={t('fields.area_label')} value={area.label} maxLength={160} onChange={value => mutate(next => { next.searchAreas[index].label = value })} />
      <p className="text-xs text-dim">{t('areas.selected', { count: area.locations.length })}</p>
      <div className="grid sm:grid-cols-2 gap-x-4 max-h-64 overflow-auto rounded-lg border border-line p-2">
        {matching.map(option => <label key={option.value} className="flex gap-2 items-center min-h-10 text-sm text-ink2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 shrink-0 accent-coral" checked={area.locations.some(value => normalizeLocation(value) === normalizeLocation(option.value))}
            onChange={event => mutate(next => {
              const isChecked = event.target.checked
              for (const group of next.searchAreas) group.locations = group.locations.filter(value => normalizeLocation(value) !== normalizeLocation(option.value))
              if (isChecked) next.searchAreas[index].locations.push(option.value)
            })} />
          <span>{option.value}</span>
        </label>)}
      </div>
      <OrderControls name={area.label.en} index={index} total={draft.searchAreas.length} canRemove={draft.searchAreas.length > 1}
        onMove={direction => mutate(next => { next.searchAreas = moved(next.searchAreas, index, direction) })}
        onRemove={() => mutate(next => { next.searchAreas.splice(index, 1) })} />
    </EditorCard>)}
    <button type="button" className={editorButton} disabled={draft.searchAreas.length >= 12} onClick={() => mutate(next => { next.searchAreas.push({ key: newId('area'), label: { en: '', es: '' }, locations: [] }) })}>{t('areas.add')}</button>
  </div>
}

export function WebsiteResourcesPanel({ draft, change }: PanelProps) {
  const { t } = useTranslation('website_editor')
  const mutate = useDraftMutation(change)
  const update = (kind: 'resources' | 'realtorTools', index: number, patch: Partial<RealtorTool>) => mutate(next => {
    if (kind === 'resources') next.resources[index] = { ...next.resources[index], ...patch }
    else next.realtorTools[index] = { ...next.realtorTools[index], ...patch }
  })
  return <div className="space-y-6">
    <p className="text-sm text-dim leading-relaxed">{t('resources.help')}</p>
    {(['resources', 'realtorTools'] as const).map(kind => <section key={kind} className="space-y-4">
      <h3 className="text-lg font-bold text-ink">{t(`resources.${kind}`)}</h3>
      {draft[kind].map((item, index) => <EditorCard key={item.id} title={item.title.en || t('resources.item')}>
        <LocalizedFields label={t('fields.title')} value={item.title} maxLength={160} onChange={value => update(kind, index, { title: value })} />
        <LocalizedFields label={t('fields.description')} value={item.description} multiline maxLength={4000} onChange={value => update(kind, index, { description: value })} />
        <LocalizedFields label={t('fields.category')} value={item.category} maxLength={160} onChange={value => update(kind, index, { category: value })} />
        <TextField label={t('fields.website_url')} value={item.url} maxLength={2048} onChange={value => update(kind, index, { url: value })} />
        {kind === 'realtorTools' && <label className="block text-sm text-ink2"><span className="block mb-1.5">{t('resources.access')}</span>
          <select className={editorInput} value={(item as RealtorTool).access} onChange={event => update(kind, index, { access: event.target.value as 'public' | 'realtor' })}>
            <option value="realtor">{t('resources.realtor_only')}</option><option value="public">{t('resources.public')}</option>
          </select>
        </label>}
        <VisibilityField value={item.enabled} onChange={value => update(kind, index, { enabled: value })} />
        <OrderControls name={item.title.en} index={index} total={draft[kind].length}
          onMove={direction => mutate(next => { if (kind === 'resources') next.resources = moved(next.resources, index, direction); else next.realtorTools = moved(next.realtorTools, index, direction) })}
          onRemove={() => mutate(next => {
            if (kind === 'realtorTools' && DEFAULT_REALTOR_TOOLS.some(tool => tool.id === item.id)) next.realtorTools[index].enabled = false
            else next[kind].splice(index, 1)
          })} />
      </EditorCard>)}
      <button type="button" className={editorButton} disabled={draft[kind].length >= 100} onClick={() => mutate(next => {
        const item: WebsiteResource = { id: newId('link'), title: { en: '', es: '' }, description: { en: '', es: '' }, category: { en: '', es: '' }, url: '', enabled: true }
        if (kind === 'resources') next.resources.push(item)
        else next.realtorTools.push({ ...item, access: 'realtor', mode: 'link' })
      })}>{t(kind === 'resources' ? 'resources.add_resource' : 'resources.add_tool')}</button>
    </section>)}
  </div>
}

export function WebsiteTeamPanel({ draft, change, onBusy }: PanelProps & { onBusy: (value: boolean) => void }) {
  const { t } = useTranslation('website_editor')
  const mutate = useDraftMutation(change)
  return <div className="space-y-4">
    <p className="text-sm text-dim">{t('team.help')}</p>
    {draft.teamMembers.map((person, index) => <EditorCard key={person.id} title={person.name || t('team.item')}>
      <TextField label={t('fields.name')} value={person.name} maxLength={120} onChange={value => mutate(next => { next.teamMembers[index].name = value })} />
      <LocalizedFields label={t('fields.role')} value={person.role} maxLength={160} onChange={value => mutate(next => { next.teamMembers[index].role = value })} />
      <LocalizedFields label={t('fields.description')} value={person.description} multiline maxLength={4000} onChange={value => mutate(next => { next.teamMembers[index].description = value })} />
      <label className="block text-sm text-ink2"><span className="block mb-1.5">{t('team.section')}</span>
        <select className={editorInput} value={person.section} onChange={event => mutate(next => { next.teamMembers[index].section = event.target.value as 'leadership' | 'realtor' })}>
          <option value="leadership">{t('team.leadership')}</option><option value="realtor">{t('team.realtor')}</option>
        </select>
      </label>
      <PhotoField label={person.name || t('team.item')} value={person.photo} onBusy={onBusy} onChange={value => mutate(next => {
        const target = next.teamMembers.find(item => item.id === person.id)
        if (target) target.photo = value
      })} />
      <VisibilityField value={person.enabled} onChange={value => mutate(next => { next.teamMembers[index].enabled = value })} />
      <OrderControls name={person.name} index={index} total={draft.teamMembers.length} canRemove={draft.teamMembers.length > 1}
        onMove={direction => mutate(next => { next.teamMembers = moved(next.teamMembers, index, direction) })}
        onRemove={() => mutate(next => { next.teamMembers.splice(index, 1) })} />
    </EditorCard>)}
    <button type="button" className={editorButton} disabled={draft.teamMembers.length >= 100} onClick={() => mutate(next => {
      next.teamMembers.push({ id: newId('person'), name: '', role: { en: '', es: '' }, description: { en: '', es: '' }, photo: '', section: 'realtor', enabled: true })
    })}>{t('team.add')}</button>
  </div>
}
