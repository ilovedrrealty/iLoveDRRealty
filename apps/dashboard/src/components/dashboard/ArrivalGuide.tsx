import { isAxiosError } from 'axios'
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ARRIVAL_GUIDE_FIELDS,
  ARRIVAL_GUIDE_MAX_LENGTH,
  arrivalGuideExpiry,
  arrivalGuideFields,
  emptyArrivalGuide,
  getGuestArrivalGuide,
  getOwnerArrivalGuide,
  prepareArrivalGuide,
  saveOwnerArrivalGuide,
  type ArrivalGuideContent,
  type ArrivalGuideLanguage,
  type GuestArrivalGuide,
  type OwnerArrivalGuide,
} from '../../api/arrivalGuide'
import { useNetworkDraftGuard } from '../network/NetworkShared'

const BUTTON = 'min-h-11 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50'
const PRIMARY = 'min-h-11 rounded-lg bg-sea px-3 py-2 text-sm font-semibold text-white disabled:opacity-50'
const FIELD = 'block w-full min-w-0 resize-y rounded-lg border border-line bg-white p-2 text-sm font-normal text-ink'

function accessDenied(error: unknown): boolean {
  return isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)
}

export function OwnerArrivalGuideEditor({ listingId }: { listingId: string }) {
  const { t } = useTranslation('common', { keyPrefix: 'arrival_guide' })
  const heading = useId()
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-xl bg-paper2 p-4" aria-labelledby={heading}>
      <h2 id={heading} className="mb-2 text-sm font-bold text-ink">{t('title')}</h2>
      {open ? <OwnerArrivalGuideForm listingId={listingId} /> : (
        <button type="button" className={BUTTON} onClick={() => setOpen(true)}>{t('manage')}</button>
      )}
    </section>
  )
}

function OwnerArrivalGuideForm({ listingId }: { listingId: string }) {
  const { t } = useTranslation('common', { keyPrefix: 'arrival_guide' })
  const fieldId = useId()
  const [baseline, setBaseline] = useState<OwnerArrivalGuide | null>(null)
  const [draft, setDraft] = useState(emptyArrivalGuide)
  const [reload, setReload] = useState(0)
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'denied' | 'error'>('loading')
  const [notice, setNotice] = useState<'saved' | 'cleared' | 'invalid' | 'conflict' | 'uncertain' | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [busy, setBusy] = useState(false)
  const mutation = useRef<AbortController | null>(null)
  const dirty = ARRIVAL_GUIDE_FIELDS.some(field => draft.en[field] !== (baseline?.content?.en[field] ?? '')
    || draft.es[field] !== (baseline?.content?.es[field] ?? ''))
  const prepared = prepareArrivalGuide(draft)
  const refreshRequired = notice === 'conflict' || notice === 'uncertain'
  useNetworkDraftGuard(loadState === 'ready' && dirty, busy)

  useEffect(() => {
    const controller = new AbortController()
    setLoadState('loading')
    setBaseline(null)
    setDraft(emptyArrivalGuide())
    setNotice(null)
    getOwnerArrivalGuide(listingId, controller.signal).then(guide => {
      if (controller.signal.aborted) return
      setBaseline(guide)
      setDraft(guide.content ?? emptyArrivalGuide())
      setLoadState('ready')
    }).catch(error => {
      if (!controller.signal.aborted) setLoadState(accessDenied(error) ? 'denied' : 'error')
    })
    return () => controller.abort()
  }, [listingId, reload])

  useEffect(() => () => mutation.current?.abort(), [])

  async function persist(content: ArrivalGuideContent | null) {
    if (mutation.current || refreshRequired || !baseline || loadState !== 'ready') return
    const controller = new AbortController()
    mutation.current = controller
    setBusy(true)
    setNotice(null)
    setConfirmClear(false)
    try {
      const guide = await saveOwnerArrivalGuide(listingId, baseline.version, content, controller.signal)
      if (controller.signal.aborted) return
      setBaseline(guide)
      setDraft(guide.content ?? emptyArrivalGuide())
      setNotice(content === null ? 'cleared' : 'saved')
    } catch (error) {
      if (controller.signal.aborted) return
      if (accessDenied(error)) {
        setBaseline(null)
        setDraft(emptyArrivalGuide())
        setLoadState('denied')
      } else {
        const status = isAxiosError(error) ? error.response?.status : undefined
        setNotice(status === 409 ? 'conflict' : status === 422 ? 'invalid' : 'uncertain')
      }
    } finally {
      if (mutation.current === controller) mutation.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (prepared && dirty && !confirmClear && !confirmRefresh) void persist(prepared)
  }

  function refresh() {
    setConfirmRefresh(false)
    setReload(value => value + 1)
  }

  if (loadState === 'loading') return <p role="status" className="text-sm text-dim">{t('loading')}</p>
  if (loadState === 'denied') return <p role="status" className="text-sm text-dim">{t('owner_unavailable')}</p>
  if (loadState === 'error') return <div className="space-y-2">
    <p role="alert" className="text-sm text-ink">{t('load_failed')}</p>
    <button type="button" className={BUTTON} onClick={refresh}>{t('retry')}</button>
  </div>

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <p className="text-sm text-dim">{t('owner_hint')}</p>
      {(['en', 'es'] as const).map(language => (
        <fieldset disabled={busy || refreshRequired || confirmClear || confirmRefresh}
          key={language} className="min-w-0 space-y-2 rounded-lg border border-line p-3">
          <legend lang={language} className="px-1 text-sm font-semibold text-ink">{t(language)}</legend>
          {ARRIVAL_GUIDE_FIELDS.map(field => {
            const overLimit = Array.from(draft[language][field].trim()).length > ARRIVAL_GUIDE_MAX_LENGTH
            const fieldErrorId = `${fieldId}-${language}-${field}`
            return <label key={field} className="block space-y-1 text-sm font-medium text-ink">
              <span>{t(field)}</span>
              <textarea
                className={FIELD}
                lang={language}
                aria-invalid={overLimit || undefined}
                aria-describedby={overLimit ? fieldErrorId : undefined}
                maxLength={ARRIVAL_GUIDE_MAX_LENGTH * 2}
                rows={2}
                value={draft[language][field]}
                onChange={event => {
                  const value = event.target.value
                  setDraft(current => ({ ...current, [language]: { ...current[language], [field]: value } }))
                  setNotice(null)
                }}
              />
              {overLimit && <span id={fieldErrorId} className="text-red-700">{t('too_long')}</span>}
            </label>
          })}
        </fieldset>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={PRIMARY}
          disabled={busy || refreshRequired || confirmClear || confirmRefresh || !prepared || !dirty}>
          {t(busy ? 'saving' : 'save')}
        </button>
        {baseline?.content && <button type="button" className={BUTTON}
          disabled={busy || refreshRequired || confirmClear || confirmRefresh}
          onClick={() => setConfirmClear(true)}>{t('clear')}</button>}
        {refreshRequired && <button type="button" className={BUTTON} disabled={confirmRefresh}
          onClick={() => dirty ? setConfirmRefresh(true) : refresh()}>{t('refresh')}</button>}
      </div>
      {confirmClear && <div role="group" aria-label={t('clear')} className="space-y-2">
        <p className="text-sm text-ink">{t('clear_confirm')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} onClick={() => setConfirmClear(false)}>{t('go_back')}</button>
          <button type="button" className={PRIMARY} onClick={() => void persist(null)}>{t('confirm_clear')}</button>
        </div>
      </div>}
      {confirmRefresh && <div role="group" aria-label={t('refresh')} className="space-y-2">
        <p className="text-sm text-ink">{t('refresh_confirm')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} onClick={() => setConfirmRefresh(false)}>{t('go_back')}</button>
          <button type="button" className={PRIMARY} onClick={refresh}>{t('discard_refresh')}</button>
        </div>
      </div>}
      {notice && <p role={notice === 'saved' || notice === 'cleared' ? 'status' : 'alert'} className="text-sm text-ink">{t(notice)}</p>}
    </form>
  )
}

export function GuestArrivalGuidePanel({ bookingId, id }: { bookingId: string; id: string }) {
  const { i18n, t } = useTranslation('common', { keyPrefix: 'arrival_guide' })
  const heading = useId()
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [guide, setGuide] = useState<GuestArrivalGuide | null>(null)
  const [reload, setReload] = useState(0)
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const [chosenLanguage, setChosenLanguage] = useState<ArrivalGuideLanguage | null>(null)
  const language = chosenLanguage ?? (i18n.language.startsWith('es') ? 'es' : 'en')
  const expiry = guide ? arrivalGuideExpiry(guide.available_until) : NaN
  const fields = guide && visible && Date.now() < expiry ? arrivalGuideFields(guide.content, language) : []

  useEffect(() => {
    const controller = new AbortController()
    setState('loading')
    setGuide(null)
    getGuestArrivalGuide(bookingId, controller.signal).then(received => {
      if (controller.signal.aborted) return
      if (!(arrivalGuideExpiry(received.available_until) > Date.now())) {
        setState('unavailable')
        return
      }
      setGuide(received)
      setState('ready')
    }).catch(error => {
      if (!controller.signal.aborted) setState(accessDenied(error) ? 'unavailable' : 'error')
    })
    return () => controller.abort()
  }, [bookingId, reload])

  useEffect(() => {
    if (!Number.isFinite(expiry)) return
    let timeout: number
    function checkExpiry() {
      window.clearTimeout(timeout)
      const remaining = expiry - Date.now()
      if (remaining <= 0) {
        setGuide(null)
        setState('unavailable')
      } else {
        timeout = window.setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647))
      }
      setVisible(!document.hidden)
    }
    checkExpiry()
    document.addEventListener('visibilitychange', checkExpiry)
    window.addEventListener('pageshow', checkExpiry)
    window.addEventListener('focus', checkExpiry)
    return () => {
      window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', checkExpiry)
      window.removeEventListener('pageshow', checkExpiry)
      window.removeEventListener('focus', checkExpiry)
    }
  }, [expiry])

  return (
    <section id={id} aria-labelledby={heading} className="min-w-0 space-y-3 bg-paper2 px-5 py-4">
      <h2 id={heading} className="text-sm font-bold text-ink">{t('title')}</h2>
      {state === 'loading' && <p role="status" className="text-sm text-dim">{t('loading')}</p>}
      {(state === 'unavailable' || state === 'ready' && visible && !fields.length) && (
        <p role="status" className="text-sm text-dim">{t('unavailable')}</p>
      )}
      {state === 'error' && <div className="space-y-2">
        <p role="alert" className="text-sm text-ink">{t('load_failed')}</p>
        <button type="button" className={BUTTON} onClick={() => setReload(value => value + 1)}>{t('retry')}</button>
      </div>}
      {fields.length > 0 && <>
        <div role="group" aria-label={t('language')} className="flex flex-wrap gap-2">
          {(['en', 'es'] as const).map(option => (
            <button type="button" key={option} lang={option} className={language === option ? PRIMARY : BUTTON}
              aria-pressed={language === option} onClick={() => setChosenLanguage(option)}>{t(option)}</button>
          ))}
        </div>
        <dl className="space-y-3">
          {fields.map(field => <div key={field.field}>
            <dt className="text-sm font-semibold text-ink">{t(field.field)}</dt>
            <dd lang={field.language} className="m-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-ink2">{field.value}</dd>
          </div>)}
        </dl>
      </>}
    </section>
  )
}
