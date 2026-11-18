import { isAxiosError } from 'axios'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { viewingShortlistSource, type ViewingShortlistSource } from '../../../../../packages/dashboard-links'
import { readViewingShortlist, shortlistCatalog, shortlistExpiryAt } from '../../api/shortlists'
import {
  VIEWING_DURATION_MINUTES, VIEWING_PAGE_SIZE, VIEWING_STOP_LIMIT, VIEWING_ZONE, getAssignedViewings, getMyViewings, getViewingContact,
  prepareViewingStops, submitViewing, updateViewing, viewingActions, viewingId, viewingMeetingUrl,
  viewingSchedulingUrl, viewingTime, type Viewing, type ViewingAction, type ViewingContact,
  type ViewingDraft, type ViewingItinerary, type ViewingMode,
} from '../../api/viewings'
import {
  allowNetworkNavigation, NETWORK_BUTTON as Button, NETWORK_FIELD as Field,
  NETWORK_PRIMARY as Primary, useNetworkDraftGuard,
} from '../../components/network/NetworkShared'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { useShortlistExpired } from '../../hooks/useShortlistExpired'
import type { UserInfo } from '../../lib/auth'
import { landingBaseUrl } from '../../lib/siteUrls'

type Problem = 'unavailable' | 'conflict' | 'validation' | 'uncertain'
const LANDING = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const status = (error: unknown) => isAxiosError(error) ? error.response?.status : undefined
const errorKey = (error: unknown): Problem => {
  const code = status(error)
  return code === 409 ? 'conflict' : code === 422 ? 'validation'
    : code && [401, 403, 404].includes(code) ? 'unavailable' : 'uncertain'
}

export function Viewings({ user }: { user: UserInfo }) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  const [params, setParams] = useSearchParams()
  const selected = params.getAll('listing')
  const linkedShortlist = params.has('shortlist') || params.has('shortlist_scope')
  const source = viewingShortlistSource(params)
  const initial = !linkedShortlist && selected.length === 1 ? viewingId(selected[0]) : null
  const buyer = user.role === 'buyer'
  const assigned = user.role === 'realtor' || user.role === 'admin'
  const [draft, setDraft] = useState(false)
  const [saved, setSaved] = useState(false)
  function close(submitted = false) {
    if (!submitted && !allowNetworkNavigation()) return
    setDraft(false); setSaved(submitted)
    if (selected.length || linkedShortlist) {
      const next = new URLSearchParams(params)
      for (const key of ['listing', 'shortlist', 'shortlist_scope']) next.delete(key)
      setParams(next, { replace: true })
    }
  }
  if (!buyer && !assigned) return <p>{t('unavailable')}</p>
  return <div className="min-w-0 space-y-4">
    {saved && !source && !initial && <p role="status" className="text-sm font-semibold text-sea">{t('submitted')}</p>}
    {buyer && (draft || source || initial)
      ? <ViewingForm key={`${user.id}:${source?.scope ?? ''}:${source?.id ?? initial ?? 'new'}`}
          actorId={user.id} initialListing={initial} source={source} onClose={() => close()} onSaved={() => close(true)} />
      : <>
        {buyer && linkedShortlist && <p role="status" className="text-sm text-dim">{t('shortlist_unavailable')}</p>}
        {buyer && <button type="button" className={Primary} onClick={() => { setSaved(false); setDraft(true) }}>{t('create')}</button>}
        {buyer ? <BuyerItineraries actorId={user.id} /> : <AssignedViewings actorId={user.id} />}
      </>}
  </div>
}

type StopDraft = ViewingDraft & { contact: ViewingContact }
function emptyStop(contact: ViewingContact): StopDraft {
  return { listing_id: contact.listing.id, mode: 'in_person', local_start: '', note: '', contact }
}

function ViewingForm({ actorId, initialListing, source, onClose, onSaved }: {
  actorId: string; initialListing: string | null; source: ViewingShortlistSource | null; onClose: () => void; onSaved: () => void
}) {
  const { t, i18n } = useTranslation('common', { keyPrefix: 'viewings' })
  const guides = new URL('/local-guides/compare/', LANDING)
  guides.searchParams.set('lang', i18n.language.startsWith('es') ? 'es' : 'en')
  const [title, setTitle] = useState('')
  const [stops, setStops] = useState<StopDraft[]>([])
  const [picker, setPicker] = useState(false)
  const [page, setPage] = useState(1)
  const [pendingListing, setPendingListing] = useState(initialListing)
  const [contactError, setContactError] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState(false)
  const active = useRef(false)
  const writing = useRef(false)
  const request = useRef<{ id: string; content: string } | null>(null)
  const catalog = useNetworkRead(`viewing-listings:${page}`, signal => shortlistCatalog(page, signal), picker)
  const shortlist = useNetworkRead(`viewing-shortlist:${actorId}:${source?.scope}:${source?.id}`, signal => {
    if (!source) throw new Error('Missing shortlist source')
    return readViewingShortlist(source, signal)
  }, !!source)
  const expired = useShortlistExpired(shortlist.data?.expires_at)
  const unavailable = expired || [401, 403, 404].includes(status(shortlist.error) ?? 0)
  const shortlistChoices = !unavailable && !shortlist.error && !shortlist.stale && !shortlist.checking ? shortlist.data : null
  const choices = !catalog.error && !catalog.stale && !catalog.checking ? catalog.data : null
  const cannotAdd = (id: string) => !!pendingListing || stops.length >= VIEWING_STOP_LIMIT || stops.some(stop => stop.listing_id === id)
  const frozen = busy || problem === 'uncertain'
  const prepared = prepareViewingStops(stops)
  useNetworkDraftGuard(!!title || stops.length > 0, busy)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    if (!pendingListing) return
    const abort = new AbortController()
    setContactError(false)
    getViewingContact(pendingListing, abort.signal).then(contact => {
      if (abort.signal.aborted) return
      setStops(current => current.length >= VIEWING_STOP_LIMIT || current.some(stop => stop.listing_id === pendingListing)
        ? current : [...current, emptyStop(contact)])
    }).catch(() => {
      if (!abort.signal.aborted) setContactError(true)
    }).finally(() => { if (!abort.signal.aborted) setPendingListing(null) })
    return () => abort.abort()
  }, [pendingListing])

  function change(id: string, values: Partial<ViewingDraft>) {
    setStops(current => current.map(stop => stop.listing_id === id ? { ...stop, ...values } : stop))
    setProblem(null)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const validStops = prepareViewingStops(stops)
    if (writing.current || pendingListing || !title.trim() || !validStops) return
    const input = { title: title.trim(), stops: validStops }
    const content = JSON.stringify(input)
    if (!request.current || request.current.content !== content) request.current = { id: crypto.randomUUID(), content }
    writing.current = true
    setBusy(true); setProblem(null)
    try {
      await submitViewing({ request_id: request.current.id, ...input })
      if (active.current) onSaved()
    } catch (error) {
      if (active.current) setProblem(errorKey(error))
    } finally {
      writing.current = false
      if (active.current) setBusy(false)
    }
  }

  return <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
    <h2 className="text-lg font-bold text-ink">{t('create')}</h2>
    <p className="text-sm text-dim">{t('request_hint', { duration: VIEWING_DURATION_MINUTES })}</p>
    <a className={Button} href={guides.href} target="_blank" rel="noopener noreferrer">{t('compare_neighborhoods')}</a>
    <form className="space-y-4" onSubmit={submit}>
      <fieldset className="min-w-0 space-y-4" disabled={frozen}>
        <label className="block text-sm font-semibold">{t('title')}
          <input className={Field} maxLength={100} required value={title} onChange={event => { setTitle(event.target.value); setProblem(null) }} />
        </label>
        {stops.map(stop => {
          const calendar = viewingSchedulingUrl(stop.contact.scheduling_url)
          return <fieldset key={stop.listing_id} className="min-w-0 space-y-3 rounded-lg border border-line p-3">
          <legend className="max-w-full break-words px-1 font-semibold text-ink">{stop.contact.listing.title}</legend>
          <p className="break-words text-sm text-dim">{stop.contact.listing.location} · {stop.contact.agent_name || t('assigned_contact')}</p>
          {calendar && <a className={Button} href={calendar} target="_blank" rel="noopener noreferrer">{t('agent_calendar')}</a>}
          <label className="block text-sm font-semibold">{t('mode')}<select className={Field} value={stop.mode}
            onChange={event => change(stop.listing_id, { mode: event.target.value as ViewingMode })}>
            <option value="in_person">{t('in_person')}</option><option value="virtual">{t('virtual')}</option>
          </select></label>
          <label className="block min-w-0 text-sm font-semibold">{t('starts')}
            <input type="datetime-local" className={Field} step={60} required value={stop.local_start}
              onChange={event => change(stop.listing_id, { local_start: event.target.value })} />
          </label>
          <label className="block text-sm font-semibold">{t('note')}<textarea className={Field} rows={2} maxLength={1000}
            value={stop.note} onChange={event => change(stop.listing_id, { note: event.target.value })} /></label>
          <button type="button" className={Button} onClick={() => {
            setStops(current => current.filter(row => row.listing_id !== stop.listing_id)); setProblem(null)
          }}>{t('remove')}</button>
        </fieldset>
        })}
        {pendingListing && <p role="status" className="text-sm text-dim">{t('loading_contact')}</p>}
        {contactError && <p role="alert" className="text-sm text-ink">{t('contact_unavailable')}</p>}
        {!prepared && stops.length > 0 && stops.every(stop => stop.local_start)
          && <p className="text-sm text-ink">{t('invalid_slots')}</p>}
        {source && <section className="min-w-0 space-y-2 rounded-lg border border-line p-3">
          <h3 className="font-semibold text-ink">{t('shortlist_properties')}</h3>
          {unavailable && <p role="status">{t('shortlist_unavailable')}</p>}
          {!unavailable && !!shortlist.error && <>
            <p role="alert">{t('shortlist_problem')}</p>
            <button type="button" className={Button} onClick={shortlist.refresh}>{t('refresh')}</button>
          </>}
          {!unavailable && !shortlist.error && !shortlistChoices && <p role="status">{t('shortlist_loading')}</p>}
          {shortlistChoices && (shortlistChoices.items.length ? <ul className="space-y-2">
            {shortlistChoices.items.map(listing => <li key={listing.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm">{listing.title} · {listing.location}</span>
              <button type="button" className={Button} aria-label={t('add_named', { title: listing.title })}
                disabled={cannotAdd(listing.id)} onClick={() => {
                  const expiry = shortlistChoices.expires_at
                  if (!expiry || Date.now() < shortlistExpiryAt(expiry)) setPendingListing(listing.id)
                }}>{t('add')}</button>
            </li>)}
          </ul> : <p>{t('shortlist_empty')}</p>)}
        </section>}
        <button type="button" className={Button} aria-expanded={picker} disabled={stops.length >= VIEWING_STOP_LIMIT}
          onClick={() => setPicker(value => !value)}>{t('choose_properties')}</button>
        {picker && <section className="min-w-0 space-y-2 rounded-lg border border-line p-3">
          <h3 className="font-semibold text-ink">{t('catalogue')}</h3>
          {catalog.error ? <p role="alert">{t('problem')}</p> : !choices && <p role="status">{t('loading')}</p>}
          {choices && <ul className="space-y-2">
            {choices.items.map(listing => <li key={listing.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 break-words text-sm">{listing.title} · {listing.location}</span>
              <button type="button" className={Button} aria-label={t('add_named', { title: listing.title })}
                disabled={cannotAdd(listing.id)}
                onClick={() => setPendingListing(listing.id)}>{t('add')}</button>
            </li>)}
          </ul>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={Button} disabled={page <= 1 || catalog.checking}
              onClick={() => setPage(value => value - 1)}>{t('previous')}</button>
            <button type="button" className={Button} disabled={!choices || choices.total <= page * 20}
              onClick={() => setPage(value => value + 1)}>{t('next')}</button>
            {!!catalog.error && <button type="button" className={Button} onClick={catalog.refresh}>{t('refresh')}</button>}
          </div>
        </section>}
      </fieldset>
      {problem && <p role="alert" className="text-sm text-ink">{t(problem === 'uncertain' ? 'uncertain_create' : problem)}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={Primary} disabled={busy || !prepared || !title.trim() || !!pendingListing}>
          {t(busy ? 'saving' : problem === 'uncertain' ? 'retry_request' : 'submit')}
        </button>
        <button type="button" className={Button} disabled={busy} onClick={onClose}>{t('close')}</button>
      </div>
    </form>
  </section>
}

function BuyerItineraries({ actorId }: { actorId: string }) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  const [page, setPage] = useState(1)
  const read = useNetworkRead(`viewer-itineraries:${actorId}:${page}`, signal => getMyViewings(page, signal))
  const rows = !read.error && !read.stale ? read.data : null
  return <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
    <h2 className="text-lg font-bold text-ink">{t('my_itineraries')}</h2>
    <ReadStatus loading={!rows} problem={!!read.error} refresh={read.refresh} />
    {rows && (rows.length ? <ul className="space-y-4">
      {rows.map(itinerary => <Itinerary key={itinerary.id} data={itinerary} checking={read.checking} onUpdated={read.refresh} />)}
    </ul> : <p className="text-sm text-dim">{t('empty_mine')}</p>)}
    <ViewingPages page={page} rowCount={rows?.length ?? 0} checking={read.checking} onPage={setPage} />
  </section>
}

function Itinerary({ data, checking, onUpdated }: { data: ViewingItinerary; checking: boolean; onUpdated: () => void }) {
  return <li className="min-w-0 space-y-3 rounded-lg border border-line p-3">
    <h3 className="break-words font-semibold text-ink">{data.title}</h3>
    <ul className="space-y-2">{data.items.map(item => <ViewingCard key={item.id} data={item} checking={checking} onUpdated={onUpdated} />)}</ul>
  </li>
}

function AssignedViewings({ actorId }: { actorId: string }) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  const [page, setPage] = useState(1)
  const read = useNetworkRead(`assigned-viewings:${actorId}:${page}`, signal => getAssignedViewings(page, signal))
  const rows = !read.error && !read.stale ? read.data : null
  return <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
    <h2 className="text-lg font-bold text-ink">{t('assigned')}</h2>
    <ReadStatus loading={!rows} problem={!!read.error} refresh={read.refresh} />
    {rows && (rows.length ? <ul className="space-y-3">
      {rows.map(item => <ViewingCard key={item.id} data={item} assigned checking={read.checking} onUpdated={read.refresh} />)}
    </ul> : <p className="text-sm text-dim">{t('empty_assigned')}</p>)}
    <ViewingPages page={page} rowCount={rows?.length ?? 0} checking={read.checking} onPage={setPage} />
  </section>
}

function ViewingPages({ page, rowCount, checking, onPage }: {
  page: number; rowCount: number; checking: boolean; onPage: (page: number) => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  if (page === 1 && rowCount < VIEWING_PAGE_SIZE) return null
  return <div className="flex flex-wrap gap-2">
    <button type="button" className={Button} disabled={checking || page === 1}
      onClick={() => { if (allowNetworkNavigation()) onPage(page - 1) }}>{t('previous')}</button>
    <button type="button" className={Button} disabled={checking || rowCount < VIEWING_PAGE_SIZE || page >= 1000}
      onClick={() => { if (allowNetworkNavigation()) onPage(page + 1) }}>{t('next')}</button>
  </div>
}

function ReadStatus({ loading, problem, refresh }: { loading: boolean; problem: boolean; refresh: () => void }) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  if (problem) return <div className="space-y-2">
    <p role="alert" className="text-sm text-ink">{t('problem')}</p>
    <button type="button" className={Button} onClick={refresh}>{t('refresh')}</button>
  </div>
  return loading ? <p role="status" className="text-sm text-dim">{t('loading')}</p> : null
}

function ViewingCard({ data, assigned = false, checking, onUpdated }: {
  data: Viewing; assigned?: boolean; checking: boolean; onUpdated: () => void
}) {
  const { i18n, t } = useTranslation('common', { keyPrefix: 'viewings' })
  const [edit, setEdit] = useState<{ action: ViewingAction; version: number } | null>(null)
  const [accepted, setAccepted] = useState<Viewing | null>(null)
  const row = accepted && accepted.version > data.version ? accepted : data
  const time = new Intl.DateTimeFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: VIEWING_ZONE,
  }).format(Date.parse(row.starts_at))
  const meeting = row.status === 'confirmed' && row.meeting_url ? viewingMeetingUrl(row.meeting_url) : null
  const schedule = !assigned && row.status !== 'unavailable' ? viewingSchedulingUrl(row.scheduling_url) : null
  const actions = viewingActions(row.status, assigned)
  return <li className="min-w-0 space-y-3 rounded-lg border border-line p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h4 className="min-w-0 break-words font-semibold text-ink">{row.listing.title}</h4>
      <span className="rounded-full bg-paper2 px-2 py-1 text-xs font-semibold text-ink">{t(`states.${row.status}`)}</span>
    </div>
    <p className="break-words text-sm text-dim">{[row.listing.location, assigned ? row.attendee_name : row.agent_name].filter(Boolean).join(' · ')}</p>
    <p className="text-sm text-ink"><time dateTime={row.starts_at}>{time}</time> · {t('zone')} · {t(row.mode)}</p>
    {row.note && <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-ink">{row.note}</p>}
    {row.status === 'confirmed' && row.meeting_details && <p className="whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-ink">{row.meeting_details}</p>}
    <div className="flex flex-wrap gap-2">
      {meeting && <a href={meeting} target="_blank" rel="noopener noreferrer" className={Button}>{t('open_meeting')}</a>}
      {schedule && <a href={schedule} target="_blank" rel="noopener noreferrer" className={Button}>{t('agent_calendar')}</a>}
      {!edit && actions.map(action => <button key={action} type="button" className={Button} disabled={checking}
        onClick={() => setEdit({ action, version: row.version })}>{t(`actions.${action}`)}</button>)}
    </div>
    {edit && <ViewingChange key={`${edit.action}:${edit.version}`} data={row} action={edit.action} version={edit.version} checking={checking}
      onClose={() => { if (allowNetworkNavigation()) setEdit(null) }} onUpdated={updated => {
        setAccepted(updated); setEdit(null); onUpdated()
      }} onRefresh={onUpdated} />}
  </li>
}

function ViewingChange({ data, action, version, checking, onClose, onUpdated, onRefresh }: {
  data: Viewing; action: ViewingAction; version: number; checking: boolean; onClose: () => void
  onUpdated: (result: Viewing) => void; onRefresh: () => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'viewings' })
  const [time, setTime] = useState('')
  const [details, setDetails] = useState('')
  const [url, setUrl] = useState('')
  const [availability, setAvailability] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const writing = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const meetingEdit = action === 'confirm' || action === 'propose'
  const starts_at = action === 'propose' ? viewingTime(time) : null
  const meeting_url = data.mode === 'virtual' ? viewingMeetingUrl(url) : null
  const valid = !meetingEdit || (availability && (action !== 'propose' || !!starts_at)
    && (data.mode === 'virtual' ? !!meeting_url : !!details.trim()))
  const stale = data.version !== version
  const locked = stale || busy || checking || problem === 'uncertain' || problem === 'unavailable' || problem === 'conflict'
  useNetworkDraftGuard(!!time || !!url || !!details || availability, busy)
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!valid || locked || writing.current) return
    writing.current = true
    setBusy(true); setProblem(null)
    try {
      const result = await updateViewing(data.id, {
        expected_version: version, action,
        ...(starts_at ? { starts_at } : {}),
        ...(meetingEdit ? { availability_checked: true as const, ...(meeting_url
          ? { meeting_url } : { meeting_details: details.trim() }) } : {}),
      })
      if (mounted.current) onUpdated(result)
    } catch (error) {
      if (mounted.current) { setProblem(errorKey(error)); onRefresh() }
    } finally {
      writing.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return <form onSubmit={save} className="min-w-0 space-y-3 rounded-lg border border-line p-3">
    <fieldset className="min-w-0 space-y-3" disabled={locked}>
      <legend className="font-semibold">{t(`actions.${action}`)}</legend>
      {action === 'propose' && <label className="block min-w-0 text-sm font-semibold">{t('new_time')}
        <input type="datetime-local" className={Field} step={60} required value={time}
          onChange={event => setTime(event.target.value)} /></label>}
      {meetingEdit && <>
        {data.mode === 'virtual' ? <label className="block text-sm font-semibold">{t('meeting_link')}
          <input type="url" className={Field} required value={url} maxLength={600}
            onChange={event => setUrl(event.target.value)} /></label>
          : <label className="block text-sm font-semibold">{t('meeting_place')}
            <textarea className={Field} rows={2} required value={details} maxLength={1000}
              onChange={event => setDetails(event.target.value)} /></label>}
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" required checked={availability} onChange={event => setAvailability(event.target.checked)} />
          {t('availability')}</label>
      </>}
    </fieldset>
    {(stale || problem) && <p role="alert" className="text-sm">{t(stale ? 'conflict' : problem ?? 'conflict')}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={Primary} disabled={locked || !valid}>{t(busy ? 'saving' : 'save_update')}</button>
      <button type="button" className={Button} disabled={busy} onClick={onClose}>{t('close')}</button>
    </div>
  </form>
}
