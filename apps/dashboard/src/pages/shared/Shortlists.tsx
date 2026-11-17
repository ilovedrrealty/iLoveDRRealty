import { isAxiosError } from 'axios'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import {
  archiveShortlist, createShortlist, editOwnedShortlist, editReceivedShortlist,
  listShortlists, prepareShortlist, readOwnedShortlist, readReceivedShortlist, revokeShortlist,
  shareShortlist, shortlistCatalog, shortlistExpiryAt, shortlistId, shortlistMemberCode, shortlistShareUrl,
  SHORTLIST_EXPIRIES, SHORTLIST_LIMIT, SHORTLIST_TEXT_LIMIT, SHORTLIST_TITLE_LIMIT,
  type OwnedShortlist, type ReceivedShortlist, type ShortlistDetail, type ShortlistExpiry, type ShortlistFields,
  type ShortlistListing, type ShortlistSummary, type ShortlistView, type ShortlistWrite,
} from '../../api/shortlists'
import {
  allowNetworkNavigation, NETWORK_BUTTON as Button, NETWORK_FIELD as Field, NETWORK_PRIMARY as Primary, useNetworkDraftGuard,
} from '../../components/network/NetworkShared'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import type { UserInfo } from '../../lib/auth'
import { landingBaseUrl } from '../../lib/siteUrls'

const EMPTY_FIELDS: ShortlistFields = { title: '', shared_notes: '', shared_preferences: '' }
const LANDING = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
type Notice = 'conflict' | 'uncertain' | 'invalid' | 'unavailable'
const errorCode = (error: unknown) => isAxiosError(error) ? error.response?.status : undefined
const inaccessible = (error: unknown) => [401, 403, 404].includes(errorCode(error) ?? 0)
const fieldsOf = ({ title, shared_notes, shared_preferences }: ShortlistFields): ShortlistFields =>
  ({ title, shared_notes, shared_preferences })

function Expiry({ value }: { value: string }) {
  const { i18n, t } = useTranslation('common', { keyPrefix: 'shortlists' })
  return <p className="text-sm text-dim">{t('expires')} <time dateTime={value}>
    {new Intl.DateTimeFormat(i18n.language.startsWith('es') ? 'es-DO' : 'en-US', {
      dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santo_Domingo',
    }).format(shortlistExpiryAt(value))}
  </time></p>
}

/** Expired data stays hidden when a throttled tab becomes visible again. */
function useExpired(value?: string) {
  const [, setTick] = useState(0)
  const expiry = value === undefined ? Infinity : shortlistExpiryAt(value)
  useEffect(() => {
    if (!Number.isFinite(expiry)) return
    let timer: number
    function update() {
      window.clearTimeout(timer)
      const delay = expiry - Date.now()
      if (delay > 0) timer = window.setTimeout(update, Math.min(delay, 2_147_483_647))
      setTick(tick => tick + 1)
    }
    update()
    document.addEventListener('visibilitychange', update)
    window.addEventListener('pageshow', update)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('pageshow', update)
    }
  }, [expiry])
  return !(Date.now() < expiry)
}

export function Shortlists({ user }: { user: UserInfo }) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<ShortlistView>('owned')
  const [owned, setOwned] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const suppliedGrants = params.getAll('grant')
  const grant = suppliedGrants.length === 1 ? shortlistId(suppliedGrants[0]) : null

  function leave(next?: ShortlistView, guard = true) {
    if (guard && !allowNetworkNavigation()) return
    setCreating(false)
    setOwned(null)
    if (suppliedGrants.length) setParams({}, { replace: true })
    if (next) setView(next)
  }

  return <div className="min-w-0 space-y-5">
    <nav aria-label={t('views')} className="flex flex-wrap gap-2">
      {(['owned', 'received'] as const).map(value => <button key={value} type="button"
        className={(grant ? 'received' : view) === value ? Primary : Button}
        aria-current={(grant ? 'received' : view) === value ? 'page' : undefined}
        onClick={() => leave(value)}>{t(value)}</button>)}
    </nav>
    {grant ? <ShortlistRecord key={`received:${user.id}:${grant}`} id={grant} user={user} scope="received" onBack={() => leave('received')} />
      : owned ? <ShortlistRecord key={`owned:${user.id}:${owned}`} id={owned} user={user} scope="owned"
          onBack={() => leave('owned')} onArchived={() => leave('owned', false)} />
      : creating ? <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
          <h2 className="text-lg font-bold text-ink">{t('create')}</h2>
          <button type="button" className={Button} onClick={() => leave('owned')}>{t('back')}</button>
          <ShortlistForm onCancel={() => leave('owned')} onSave={createShortlist} onSaved={result => {
            setCreating(false); setOwned(result.id)
          }} />
        </section>
      : <ShortlistList key={`${user.id}:${view}`} actorId={user.id} view={view} onCreate={() => setCreating(true)}
        onOpen={id => view === 'owned' ? setOwned(id) : setParams({ grant: id })} />}
  </div>
}

function ShortlistList({ actorId, view, onCreate, onOpen }: {
  actorId: string; view: ShortlistView; onCreate: () => void; onOpen: (id: string) => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const read = useNetworkRead(`shortlists:${actorId}:${view}`, signal => listShortlists(view, signal))
  const visible = !read.error && !read.stale && (view === 'owned' || !read.checking) ? read.data : null
  return <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold text-ink">{t(view)}</h2>
      {view === 'owned' && <button type="button" className={Primary} onClick={onCreate}>{t('create')}</button>}
    </div>
    {read.error ? <p role="alert" className="text-sm text-ink">{t(inaccessible(read.error) ? 'unavailable' : 'load_failed')}</p>
      : !visible ? <p role="status" className="text-sm text-dim">{t('loading')}</p>
      : !visible.length ? <p className="text-sm text-dim">{t(view === 'owned' ? 'empty_owned' : 'empty_received')}</p>
      : <ul className="space-y-3">{visible.map(item => <ShortlistListItem key={item.id} item={item} view={view} onOpen={onOpen} />)}</ul>}
    {!!read.error && !inaccessible(read.error) && <button type="button" className={Button} onClick={read.refresh}>{t('refresh')}</button>}
  </section>
}

function ShortlistListItem({ item, view, onOpen }: { item: ShortlistSummary; view: ShortlistView; onOpen: (id: string) => void }) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const expired = useExpired(view === 'received' ? item.expires_at ?? undefined : undefined)
  if (expired) return null
  return <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
    <div className="min-w-0 space-y-1">
      <h3 className="break-words font-semibold text-ink">{item.title}</h3>
      {item.expires_at && <Expiry value={item.expires_at} />}
    </div>
    <button type="button" className={Button} onClick={() => onOpen(item.id)}>{t('open')}</button>
  </li>
}

function ShortlistRecord({ id, user, scope, onBack, onArchived }: {
  id: string; user: UserInfo; scope: ShortlistView; onBack: () => void; onArchived?: () => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const read = useNetworkRead<OwnedShortlist | ReceivedShortlist>(`shortlist:${user.id}:${scope}:${id}`,
    signal => scope === 'owned' ? readOwnedShortlist(id, signal) : readReceivedShortlist(id, signal))
  const [editing, setEditing] = useState(false)
  const [versionFloor, setVersionFloor] = useState(0)
  const received = read.data && 'expires_at' in read.data ? read.data : null
  const expired = useExpired(received?.expires_at)
  const blocked = inaccessible(read.error) || expired
  const current = !blocked && read.data && read.data.version >= versionFloor ? read.data : null
  const visible = !!current && !read.error && !read.stale && (scope === 'owned' || !read.checking)
  const ready = visible && !read.checking

  function accept(newVersion: number) {
    setVersionFloor(newVersion)
    read.refresh()
  }

  return <section className="min-w-0 space-y-4 rounded-xl border border-line bg-paper p-4">
    <button type="button" className={Button} onClick={onBack}>{t('back')}</button>
    {blocked ? <p role="status" className="text-sm text-dim">{t('unavailable')}</p>
      : read.error ? <p role="alert" className="text-sm text-ink">{t('load_failed')}</p>
      : !visible && <p role="status" className="text-sm text-dim">{t('loading')}</p>}
    {!!read.error && !blocked && <button type="button" className={Button} onClick={read.refresh}>{t('refresh')}</button>}
    {current && editing ? <ShortlistForm initial={current} ready={ready} hidden={!visible} onRefresh={read.refresh}
      onCancel={() => { if (allowNetworkNavigation()) setEditing(false) }}
      onSave={draft => scope === 'owned' ? editOwnedShortlist(id, current.version, draft) : editReceivedShortlist(id, current.version, draft)}
      onSaved={result => { accept(result.version); setEditing(false) }} />
      : visible && current && <>
        <h2 className="break-words text-lg font-bold text-ink">{current.title}</h2>
        {received && <Expiry value={received.expires_at} />}
        <dl className="min-w-0 space-y-3">
          {(['shared_notes', 'shared_preferences'] as const).map(field => current[field] && <div key={field}>
            <dt className="font-semibold text-ink">{t(field)}</dt>
            <dd className="m-0 whitespace-pre-wrap break-words text-sm text-ink2">{current[field]}</dd>
          </div>)}
        </dl>
        <ListingChoices items={current.items} />
        <button type="button" className={Button} disabled={!ready} onClick={() => setEditing(true)}>{t('edit')}</button>
        {'share' in current && <ShareControls shortlist={current} actorCode={user.user_code} ready={ready}
          onUpdated={accept} onRefresh={read.refresh} onArchived={onArchived ?? onBack} />}
      </>}
  </section>
}

function ListingChoices({ items, onRemove, disabled }: {
  items: ShortlistListing[]; onRemove?: (id: string) => void; disabled?: boolean
}) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  return <section className="min-w-0 space-y-2">
    <h3 className="font-semibold text-ink">{t('properties')}</h3>
    {!items.length ? <p className="text-sm text-dim">{t('empty_properties')}</p> : <ul className="space-y-2">
      {items.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3">
        <div className="min-w-0 break-words">
          <p className="text-sm font-semibold text-ink">{item.title}</p>
          <p className="text-sm text-dim">{item.location} · {t(item.transaction)}</p>
        </div>
        {onRemove
          ? <button type="button" className={Button} disabled={disabled} aria-label={t('remove_named', { title: item.title })}
              onClick={() => onRemove(item.id)}>{t('remove')}</button>
          : <a className={Button} href={new URL(`/listing/${item.id}/`, LANDING).href} target="_blank" rel="noopener noreferrer">
              {t('open_property')}
            </a>}
      </li>)}
    </ul>}
  </section>
}

function ListingCatalog({ selected, onAdd }: { selected: ShortlistListing[]; onAdd: (item: ShortlistListing) => void }) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const [page, setPage] = useState(1)
  const read = useNetworkRead(`shortlist-listing-catalog:${page}`, signal => shortlistCatalog(page, signal))
  const data = read.data && !read.stale && !read.error && !read.checking ? read.data : null
  return <section className="min-w-0 space-y-2 rounded-lg border border-line p-3">
    <h3 className="font-semibold text-ink">{t('catalog')}</h3>
    {read.error ? <p role="alert">{t('load_failed')}</p> : !data && <p role="status">{t('loading')}</p>}
    {data && <ul className="space-y-2">
      {data.items.map(item => <li key={item.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 break-words text-sm">{item.title} · {item.location}</span>
        <button type="button" className={Button} disabled={selected.length >= SHORTLIST_LIMIT || selected.some(row => row.id === item.id)}
          aria-label={t('add_named', { title: item.title })} onClick={() => onAdd(item)}>{t('add')}</button>
      </li>)}
    </ul>}
    <div className="flex flex-wrap gap-2">
      <button type="button" className={Button} disabled={page <= 1 || read.checking} onClick={() => setPage(value => value - 1)}>{t('previous')}</button>
      <button type="button" className={Button} disabled={!data || data.total <= page * SHORTLIST_LIMIT}
        onClick={() => setPage(value => value + 1)}>{t('next')}</button>
      {!!read.error && <button type="button" className={Button} onClick={read.refresh}>{t('refresh')}</button>}
    </div>
  </section>
}

function ShortlistForm({ initial, ready = true, hidden = false, onRefresh, onCancel, onSave, onSaved }: {
  initial?: ShortlistDetail; ready?: boolean; hidden?: boolean; onRefresh?: () => void; onCancel: () => void
  onSave: (input: ShortlistWrite) => Promise<ShortlistDetail>; onSaved: (result: ShortlistDetail) => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const [baseline, setBaseline] = useState(initial)
  const [draft, setDraft] = useState(() => initial ? fieldsOf(initial) : { ...EMPTY_FIELDS })
  const [selection, setSelection] = useState<ShortlistListing[] | null>(initial ? null : [])
  const [catalog, setCatalog] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const items = selection ?? initial?.items ?? []
  const candidate = prepareShortlist(draft, selection?.map(item => item.id))
  const dirty = (initial ? selection !== null : items.length > 0)
    || Object.entries(draft).some(([field, value]) => value !== (baseline ?? EMPTY_FIELDS)[field as keyof ShortlistFields])
  const outOfDate = !!initial && initial.version !== baseline?.version
  const locked = busy || outOfDate || !!notice && notice !== 'invalid'
  useNetworkDraftGuard(dirty, busy)

  function reload() {
    if (!initial || !ready || !allowNetworkNavigation()) return
    setBaseline(initial); setDraft(fieldsOf(initial)); setSelection(null); setCatalog(false); setNotice(null)
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!candidate || !ready || locked || inFlight.current) return
    inFlight.current = true
    setNotice(null); setBusy(true)
    try {
      const result = await onSave(candidate)
      if (mounted.current) onSaved(result)
    } catch (error) {
      if (mounted.current) {
        const status = errorCode(error)
        setNotice(inaccessible(error) ? 'unavailable' : status === 409 ? 'conflict' : status === 422 ? 'invalid' : 'uncertain')
        onRefresh?.()
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }

  if (hidden || notice === 'unavailable') return notice === 'unavailable' ? <p role="status">{t('unavailable')}</p> : null
  return <form className="min-w-0 space-y-4" onSubmit={submit}>
    <fieldset className="min-w-0 space-y-3" disabled={!ready || locked}>
      <label className="block text-sm font-semibold">{t('title')}
        <input className={Field} required maxLength={SHORTLIST_TITLE_LIMIT * 2} value={draft.title}
          onChange={event => { setDraft({ ...draft, title: event.target.value }); setNotice(null) }} />
      </label>
      <p className="text-sm text-dim">{t('shared_hint')}</p>
      {(['shared_notes', 'shared_preferences'] as const).map(field => <label key={field} className="block text-sm font-semibold">
        {t(field)}<textarea rows={3} className={Field} maxLength={SHORTLIST_TEXT_LIMIT * 2} value={draft[field]}
          onChange={event => { setDraft({ ...draft, [field]: event.target.value }); setNotice(null) }} />
      </label>)}
      <ListingChoices items={items} onRemove={id => setSelection(items.filter(item => item.id !== id))} />
      {initial && selection !== null && <p className="text-sm text-dim">{t('property_change')}</p>}
      <button type="button" className={Button} aria-expanded={catalog}
        onClick={() => setCatalog(value => !value)}>{t('choose_properties')}</button>
      {catalog && <ListingCatalog selected={items} onAdd={item => setSelection([...items, item])} />}
    </fieldset>
    {(outOfDate || notice) && <p role="alert" className="text-sm text-ink">{t(outOfDate ? 'conflict' : notice ?? 'invalid')}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={Primary} disabled={!ready || locked || !candidate || !dirty}>{t(busy ? 'saving' : 'save')}</button>
      <button type="button" className={Button} disabled={busy} onClick={onCancel}>{t('cancel')}</button>
      {initial && (outOfDate || notice === 'conflict' || notice === 'uncertain') && <button type="button" className={Button} disabled={!ready}
        onClick={reload}>{t('review_current')}</button>}
    </div>
  </form>
}

function ShareControls({ shortlist, actorCode, ready, onUpdated, onRefresh, onArchived }: {
  shortlist: OwnedShortlist; actorCode: number | null; ready: boolean
  onUpdated: (version: number) => void; onRefresh: () => void; onArchived: () => void
}) {
  const { t } = useTranslation('common', { keyPrefix: 'shortlists' })
  const heading = useId()
  const [codeDraft, setCode] = useState('')
  const [duration, setDuration] = useState<ShortlistExpiry>(30)
  const [review, setReview] = useState<{ version: number; code: number; duration: ShortlistExpiry } | null>(null)
  const [confirm, setConfirm] = useState<'revoke' | 'archive' | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [copy, setCopy] = useState<'copied' | 'copy_failed' | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const active = shortlist.share?.state === 'active' ? shortlist.share : null
  const expired = useExpired(active?.expires_at)
  const grant = expired ? null : active
  const code = shortlistMemberCode(codeDraft)
  const link = grant ? shortlistShareUrl(window.location.origin, grant.id) : ''
  const locked = !ready || busy || notice === 'uncertain'
  useNetworkDraftGuard(!!codeDraft || !!review, busy)

  async function change(operation: Promise<OwnedShortlist | void>) {
    setBusy(true); setNotice(null); setCopy(null)
    try {
      const result = await operation
      setConfirm(null); setReview(null); setCode('')
      if (result) onUpdated(result.version)
      else onArchived()
    } catch (error) {
      setConfirm(null); setReview(null)
      const status = errorCode(error)
      setNotice(inaccessible(error) ? 'unavailable' : status === 409 ? 'conflict' : status === 422 ? 'invalid' : 'uncertain')
      onRefresh()
    } finally { inFlight.current = false; setBusy(false) }
  }

  function commitChange(build: () => Promise<OwnedShortlist | void>) {
    if (locked || inFlight.current) return
    inFlight.current = true
    void change(build())
  }

  async function copyLink() {
    if (!grant || !ready) return
    try { await navigator.clipboard.writeText(link); setCopy('copied') }
    catch { setCopy('copy_failed') }
  }

  return <section className="min-w-0 space-y-3 border-t border-line pt-4" aria-labelledby={heading}>
    <h3 id={heading} className="font-semibold text-ink">{t('sharing')}</h3>
    {shortlist.share && <div className="space-y-1 text-sm">
      <p>{t(expired ? 'expired' : shortlist.share.state)} · {t('code_value', { code: shortlist.share.recipient_user_code })}</p>
      <Expiry value={shortlist.share.expires_at} />
    </div>}
    {grant ? <div className="min-w-0 space-y-2">
      {ready && !busy && <label className="block text-sm font-semibold">{t('private_link')}<input className={Field} readOnly value={link} /></label>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={Button} disabled={locked || !!confirm} onClick={() => void copyLink()}>{t('copy_link')}</button>
        <button type="button" className={Button} disabled={locked || !!confirm} onClick={() => setConfirm('revoke')}>{t('revoke')}</button>
      </div>
      {copy && <p role="status" className="text-sm">{t(copy)}</p>}
    </div> : <div className="space-y-3">
      <fieldset className="min-w-0 space-y-3" disabled={locked || !!review || !!confirm}>
        <label className="block text-sm font-semibold">{t('code')}
          <input className={Field} inputMode="numeric" autoComplete="off" maxLength={11} value={codeDraft}
            onChange={event => { setCode(event.target.value); setNotice(null) }} />
        </label>
        <label className="block text-sm font-semibold">{t('duration')}
          <select className={Field} value={duration} onChange={event => {
            const value = SHORTLIST_EXPIRIES.find(days => days === Number(event.target.value))
            if (value) setDuration(value)
          }}>{SHORTLIST_EXPIRIES.map(days => <option key={days} value={days}>{t('days', { count: days })}</option>)}</select>
        </label>
        <button type="button" className={Button} disabled={code === null || code === actorCode}
          onClick={() => { if (code !== null) setReview({ version: shortlist.version, code, duration }) }}>{t('review_share')}</button>
      </fieldset>
      {review && <div role="group" aria-label={t('review_share')} className="space-y-2 rounded-lg border border-line p-3">
        <p className="break-words text-sm">{t('share_confirm', { code: review.code, count: review.duration })}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={Button} disabled={busy} onClick={() => setReview(null)}>{t('cancel')}</button>
          <button type="button" className={Primary} disabled={locked || shortlist.version !== review.version}
            onClick={() => commitChange(() => shareShortlist(shortlist.id, review.code, review.duration))}>{t('share')}</button>
        </div>
        {shortlist.version !== review.version && <p role="alert" className="text-sm">{t('conflict')}</p>}
      </div>}
    </div>}
    {!confirm && !review && <button type="button" className={Button} disabled={locked}
      onClick={() => setConfirm('archive')}>{t('archive')}</button>}
    {confirm && <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="text-sm">{t(confirm === 'revoke' ? 'revoke_confirm' : 'archive_confirm')}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={Button} disabled={busy} onClick={() => setConfirm(null)}>{t('cancel')}</button>
        <button type="button" className={Primary} disabled={locked || confirm === 'revoke' && !grant}
          onClick={() => confirm === 'archive' ? commitChange(() => archiveShortlist(shortlist.id, shortlist.version))
            : grant && commitChange(() => revokeShortlist(shortlist.id, grant.id))}>
          {t(confirm === 'revoke' ? 'confirm_revoke' : 'confirm_archive')}
        </button>
      </div>
    </div>}
    {notice && <p role="alert" className="text-sm text-ink">{t(notice)}</p>}
    {notice === 'uncertain' && <button type="button" className={Button} disabled={!ready} onClick={() => { setNotice(null); onRefresh() }}>{t('refresh')}</button>}
  </section>
}
