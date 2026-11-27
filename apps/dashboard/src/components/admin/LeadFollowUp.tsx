import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FollowUpAccessLost, getFollowUpLead, getPublicFollowUpLink } from '../../api/leadFollowUp'
import { defaultDraftKind, draftKinds, followUpDestination, followUpIdentity, internationalDestination, messagePreview, propertyDraftUrl,
  validFollowUpDraft, welcomeDraft, type DraftKind, type DraftLanguage, type FollowUpAction, type FollowUpDraft, type FollowUpLead } from '../../lib/leadFollowUp'

type Read = { kind: 'idle' | 'loading' | 'error' | 'denied' } | { kind: 'ready'; contact: FollowUpLead }
type Outcome = { kind: 'property'; url: string | null } | { kind: 'copied' | 'copy_failed' | 'requested' | 'invalid' | 'link_lost' } | null
const button = 'min-h-11 max-w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-coral disabled:opacity-40'
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm'

/** No contact-status mutation, delivery API, durable history, telemetry or storage. */
export function LeadFollowUp({ targetId }: { targetId: string }) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false), [read, setRead] = useState<Read>({ kind: 'idle' })
  const [checking, setChecking] = useState(false), [changed, setChanged] = useState(false)
  const active = useRef<AbortController | null>(null), mounted = useRef(true), busy = useRef(false)
  const alive = (controller: AbortController) => mounted.current && !controller.signal.aborted && active.current === controller
  function stop() { active.current?.abort(); active.current = null; busy.current = false; setChecking(false) }
  function close() { stop(); setOpen(false); setRead({ kind: 'idle' }); setChanged(false) }
  async function refresh() {
    stop(); setRead({ kind: 'loading' }); setChanged(false)
    const controller = new AbortController(); active.current = controller
    try { const contact = await getFollowUpLead(targetId, controller.signal); if (alive(controller)) setRead({ kind: 'ready', contact }) }
    catch (error) { if (alive(controller)) setRead({ kind: error instanceof FollowUpAccessLost ? 'denied' : 'error' }) }
  }
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; active.current?.abort() }
  }, [])
  useEffect(() => {
    if (!open) return
    const focus = () => { void refresh() }
    const visibility = () => { if (document.visibilityState === 'hidden') { stop(); setRead({ kind: 'idle' }); setChanged(false) } else void refresh() }
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility) }
    // Fresh handlers use only this target. The parent keys by target/assignment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetId])

  async function act(contact: FollowUpLead, action: FollowUpAction, intent: FollowUpDraft): Promise<Outcome> {
    if (busy.current) return null
    if (!['call', 'property'].includes(action) && !validFollowUpDraft(intent)) return { kind: 'invalid' }
    busy.current = true; setChecking(true); setChanged(false)
    const controller = new AbortController(); active.current?.abort(); active.current = controller
    try {
      const current = await getFollowUpLead(targetId, controller.signal)
      if (!alive(controller)) return null
      if (followUpIdentity(current) !== followUpIdentity(contact)) { setRead({ kind: 'ready', contact: current }); setChanged(true); return null }
      if (action === 'property') {
        const url = current.propertyId ? await getPublicFollowUpLink(current.propertyId, controller.signal) : null
        if (!alive(controller)) return null
        return { kind: 'property', url: current.propertyId && url === propertyDraftUrl(current.propertyId) ? url : null }
      }
      if (action !== 'call' && intent.publicUrl !== null) {
        if (!current.propertyId || intent.publicUrl !== propertyDraftUrl(current.propertyId)) return { kind: 'link_lost' }
        const url = current.propertyId ? await getPublicFollowUpLink(current.propertyId, controller.signal) : null
        if (!alive(controller)) return null
        if (!url || url !== intent.publicUrl) return { kind: 'link_lost' }
      }
      if (!alive(controller)) return null
      if (action === 'copy') {
        try { await navigator.clipboard.writeText(messagePreview(intent)); return alive(controller) ? { kind: 'copied' } : null }
        catch { return alive(controller) ? { kind: 'copy_failed' } : null }
      }
      const url = followUpDestination(action, current, intent)
      if (!url) return { kind: 'invalid' }
      // This may be blocked or ignored by the device. Never infer app opening,
      // sending, connection, delivery or contact status from this request.
      window.open(url, '_blank', 'noopener,noreferrer')
      return { kind: 'requested' }
    } catch (error) {
      if (alive(controller)) setRead({ kind: error instanceof FollowUpAccessLost ? 'denied' : 'error' })
      return null
    } finally { if (active.current === controller) { busy.current = false; setChecking(false) } }
  }
  return <section aria-label={t('manual_follow_up.title')} className="min-w-0 space-y-3">
    <button type="button" className={button} aria-expanded={open} onClick={() => { if (open) close(); else { setOpen(true); void refresh() } }}>{t(open ? 'manual_follow_up.close' : 'manual_follow_up.open')}</button>
    {open ? <>
      <h3 className="font-semibold">{t('manual_follow_up.title')}</h3>
      <p className="text-xs leading-relaxed text-ink2">{t('manual_follow_up.scope')}</p>
      <button type="button" className={button} disabled={checking || read.kind === 'loading'} onClick={() => void refresh()}>{t('manual_follow_up.refresh')}</button>
      {changed ? <p role="status">{t('manual_follow_up.changed')}</p> : null}
      {read.kind === 'loading' || read.kind === 'idle' ? <p role="status">{t('manual_follow_up.loading')}</p> : null}
      {read.kind === 'denied' ? <p role="alert">{t('manual_follow_up.denied')}</p> : null}
      {read.kind === 'error' ? <p role="alert">{t('manual_follow_up.error')}</p> : null}
      {read.kind === 'ready' ? <FollowUpEditor key={followUpIdentity(read.contact)} contact={read.contact} checking={checking} act={act} /> : null}
    </> : null}
  </section>
}

function FollowUpEditor({ contact, checking, act }: { contact: FollowUpLead; checking: boolean; act: (contact: FollowUpLead, action: FollowUpAction, intent: FollowUpDraft) => Promise<Outcome> }) {
  const { t, i18n } = useTranslation('admin')
  const initialLanguage: DraftLanguage = i18n.language.startsWith('es') ? 'es' : 'en'
  const [language, setLanguage] = useState<DraftLanguage>(initialLanguage), [kind, setKind] = useState<DraftKind>(() => defaultDraftKind(contact.type))
  const [name, setName] = useState(contact.name), [draft, setDraft] = useState(() => welcomeDraft(initialLanguage, defaultDraftKind(contact.type), contact.name))
  const [publicUrl, setPublicUrl] = useState<string | null>(null), [includeLink, setIncludeLink] = useState(false), [notice, setNotice] = useState('')
  const live = useRef(true)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const intent: FollowUpDraft = { ...draft, publicUrl: includeLink ? publicUrl : null }
  const valid = validFollowUpDraft(intent), number = internationalDestination(contact.phone)
  function regenerate(nextLanguage: DraftLanguage, nextKind: DraftKind, nextName: string) {
    setLanguage(nextLanguage); setKind(nextKind); setName(nextName); setDraft(welcomeDraft(nextLanguage, nextKind, nextName)); setIncludeLink(false); setNotice('')
  }
  async function action(value: FollowUpAction) {
    setNotice('')
    const result = await act(contact, value, { ...intent })
    if (!live.current || !result) return
    if (result.kind === 'property') { setPublicUrl(result.url); setIncludeLink(false); setNotice(result.url ? 'link_ready' : 'link_unavailable') }
    else if (result.kind === 'link_lost') { setPublicUrl(null); setIncludeLink(false); setNotice('link_unavailable') }
    else setNotice(result.kind)
  }
  if (checking) return <p role="status">{t('manual_follow_up.checking')}</p>
  return <div className="min-w-0 space-y-3">
    <dl className="min-w-0 space-y-1 text-sm [overflow-wrap:anywhere]"><dt className="font-semibold">{t('manual_follow_up.email_to')}</dt><dd>{contact.email || t('manual_follow_up.email_unavailable')}</dd>
      <dt className="font-semibold">{t('manual_follow_up.phone_to')}</dt><dd>{number || t('manual_follow_up.phone_unavailable')}</dd></dl>
    <label className="block min-w-0 text-sm">{t('manual_follow_up.name')}<input className={field} maxLength={160} value={name} onChange={event => regenerate(language, kind, event.target.value)} /></label>
    <label className="block min-w-0 text-sm">{t('manual_follow_up.language')}<select className={field} value={language} onChange={event => regenerate(event.target.value === 'es' ? 'es' : 'en', kind, name)}><option value="en">English</option><option value="es">Español</option></select></label>
    <label className="block min-w-0 text-sm">{t('manual_follow_up.template')}<select className={field} value={kind} onChange={event => { const value = event.target.value as DraftKind; if (draftKinds.includes(value)) regenerate(language, value, name) }}>{draftKinds.map(value => <option key={value} value={value}>{t('manual_follow_up.kinds.' + value)}</option>)}</select></label>
    <p className="text-xs leading-relaxed text-ink2">{t('manual_follow_up.regenerate')}</p>
    <label className="block min-w-0 text-sm">{t('manual_follow_up.subject')}<input className={field} maxLength={160} value={draft.subject} onChange={event => { setDraft(current => ({ ...current, subject: event.target.value })); setNotice('') }} /></label>
    <label className="block min-w-0 text-sm">{t('manual_follow_up.body')}<textarea className={field + ' min-h-48'} maxLength={4000} value={draft.body} onChange={event => { setDraft(current => ({ ...current, body: event.target.value })); setNotice('') }} /></label>
    {contact.propertyId ? <button type="button" className={button} onClick={() => void action('property')}>{t('manual_follow_up.check_link')}</button> : null}
    {publicUrl ? <label className="flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={includeLink} onChange={event => { setIncludeLink(event.target.checked); setNotice('') }} /><span className="min-w-0 [overflow-wrap:anywhere]">{t('manual_follow_up.include_link')}<br />{publicUrl}</span></label> : null}
    <section aria-label={t('manual_follow_up.preview')} className="min-w-0 rounded-lg border border-line bg-white p-3"><h4 className="font-semibold">{t('manual_follow_up.preview')}</h4><p className="mt-2 whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">{draft.subject}</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm [overflow-wrap:anywhere]">{messagePreview(intent)}</pre></section>
    {!valid ? <p role="alert">{t('manual_follow_up.invalid')}</p> : null}
    <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={!valid} onClick={() => void action('copy')}>{t('manual_follow_up.copy')}</button>
      <button type="button" className={button} disabled={!followUpDestination('email', contact, intent)} onClick={() => void action('email')}>{t('manual_follow_up.email')}</button>
      <button type="button" className={button} disabled={!followUpDestination('whatsapp', contact, intent)} onClick={() => void action('whatsapp')}>{t('manual_follow_up.whatsapp')}</button>
      <button type="button" className={button} disabled={!number} onClick={() => void action('call')}>{t('manual_follow_up.call')}</button></div>
    {notice ? <p role="status">{t('manual_follow_up.' + notice)}</p> : null}
    <p className="text-xs leading-relaxed text-ink2">{t('manual_follow_up.no_delivery')}</p>
    <p className="text-xs leading-relaxed text-ink2">{t('manual_follow_up.inbox_note')}</p>
  </div>
}
