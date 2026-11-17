import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getReceivedServiceReferrals, getReferralServiceProviders, getRequestReferrals, getServiceReferralSubmission,
  prepareServiceReferralAttempt, runServiceReferralAttempt,
  type ReferralAction, type ReferralRelationship, type ServiceReferral, type ServiceReferralAttempt, type ServiceRequest,
} from '../../api/serviceWorkflow'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { professionalLabel, type ProfessionalOption, type ProfessionalOptions } from '../../../../../packages/professionals/src'
import {
  NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkDate, NetworkFreshness, NetworkPagination, NetworkPanel,
  networkError, useNetworkDraftGuard,
} from './NetworkShared'
import { ServiceMutationStatus, useServiceAttempt } from './ServiceWorkflowShared'

const relationships: ReferralRelationship[] = ['worked_together', 'know_their_work', 'no_prior_work']
type ReferralPage = { items: ServiceReferral[]; can_suggest?: boolean; can_offer?: boolean }
type Review = { referral: ServiceReferral; action: ReferralAction }

function allowed(referral: ServiceReferral, action: ReferralAction) {
  return referral[`can_${action}`]
}

const transport = {
  prepare: prepareServiceReferralAttempt,
  execute: runServiceReferralAttempt,
  resolve: getServiceReferralSubmission,
  canRetry(attempt: ServiceReferralAttempt, read: ReferralPage) {
    if (attempt.action === 'create') return attempt.share_confirmed ? read.can_offer === true : read.can_suggest === true
    return read.items.some(item => item.id === attempt.referral_id && item.version === attempt.expected_version
      && allowed(item, attempt.action))
  },
}

function catalogLabel(options: ProfessionalOption[] | undefined, id: string, locale: string) {
  const option = options?.find(item => item.id === id)
  return option ? professionalLabel(option.label, locale) : id
}

function ReferralCard({ referral, options, disabled, review, openRequest }: {
  referral: ServiceReferral
  options: ProfessionalOptions
  disabled: boolean
  review: (referral: ServiceReferral, action: ReferralAction) => void
  openRequest?: (id: string) => void
}) {
  const { t, i18n } = useTranslation('property_network')
  const { language } = i18n
  return <article className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-4">
    <div className="min-w-0">
      <h3 className="break-words font-semibold">{referral.provider_alias ?? catalogLabel(options.categories, referral.category_id, language)}</h3>
      <p className="text-sm">{t('referrals.states.' + referral.status)}</p>
    </div>
    <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
      {referral.provider_alias ? <div><dt className="font-semibold">{t('service.category')}</dt><dd>{catalogLabel(options.categories, referral.category_id, language)}</dd></div> : null}
      <div><dt className="font-semibold">{t('property_class')}</dt><dd>{catalogLabel(options.property_classes, referral.property_class, language)}</dd></div>
      <div><dt className="font-semibold">{t('service.matches.area')}</dt><dd>{catalogLabel(options.areas, referral.area_id, language)}</dd></div>
      {referral.language ? <div><dt className="font-semibold">{t('referrals.language')}</dt><dd>{catalogLabel(options.languages, referral.language, language)}</dd></div> : null}
      <div><dt className="font-semibold">{t('referrals.referrer_relationship')}</dt><dd>{t('referrals.relationships.' + referral.relationship)}</dd></div>
      <div><dt className="font-semibold">{t('referrals.last_change')}</dt><dd><NetworkDate value={referral.updated_at} showTime /></dd></div>
    </dl>
    <div className="flex flex-wrap gap-2">
      {(['offer', 'accept', 'decline', 'revoke'] as const).filter(action => allowed(referral, action)).map(action =>
        <button key={action} type="button" className={NETWORK_BUTTON} disabled={disabled}
          onClick={() => review(referral, action)}>{t('referrals.review.' + action)}</button>)}
      {openRequest && referral.request_id ? <button className={NETWORK_PRIMARY} type="button" disabled={disabled}
        onClick={() => { if (referral.request_id) openRequest(referral.request_id) }}>{t('service.open_request')}</button> : null}
    </div>
  </article>
}

function ReferralConfirmation({ current, request, disabled, cancel, confirm }: {
  current: Review
  request?: ServiceRequest
  disabled: boolean
  cancel: () => void
  confirm: () => void
}) {
  const { t } = useTranslation('property_network')
  const [checked, setChecked] = useState(false)
  const { action, referral } = current
  return <form className="space-y-3 rounded-xl border border-line bg-white p-4" onSubmit={event => {
    event.preventDefault()
    if (!disabled && (action !== 'offer' || checked)) confirm()
  }}>
    <h3 className="font-semibold">{t('referrals.review.' + action)}</h3>
    <p className="text-sm">{t('referrals.confirm.' + action, { name: referral.provider_alias ?? '' })}</p>
    {action === 'offer' && request ? <>
      <SharedBrief request={request} />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" required checked={checked} onChange={event => setChecked(event.target.checked)} />
        {t('referrals.share_ack')}
      </label>
    </> : null}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className={NETWORK_PRIMARY} disabled={disabled || (action === 'offer' && !checked)}>
        {t('referrals.apply.' + action)}
      </button>
      <button type="button" className={NETWORK_BUTTON} onClick={cancel}>{t('referrals.cancel')}</button>
    </div>
  </form>
}

function SharedBrief({ request }: { request: ServiceRequest }) {
  const { t } = useTranslation('property_network')
  return <section aria-label={t('referrals.shared_brief')} className="space-y-1 rounded-lg border border-line p-3 text-sm">
    <h4 className="break-words font-semibold">{request.title}</h4>
    <p className="whitespace-pre-wrap break-words">{request.brief}</p>
    <p>{t('service.requester_alias')} · {request.requester_alias}</p>
    {request.area_label ? <p>{t('service.coarse_area')} · {request.area_label}</p> : null}
    {request.desired_start_on ? <p>{t('service.desired_start')} · <NetworkDate value={request.desired_start_on} /></p> : null}
  </section>
}

function ReferralEditor({ request, options, manager, disabled, cancel, submit }: {
  request: ServiceRequest
  options: ProfessionalOptions
  manager: boolean
  disabled: boolean
  cancel: () => void
  submit: (attempt: ServiceReferralAttempt) => void
}) {
  const { t, i18n } = useTranslation('property_network')
  const [area, setArea] = useState('')
  const [language, setLanguage] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [relationship, setRelationship] = useState<ReferralRelationship | ''>('')
  const [checked, setChecked] = useState(false)
  const criteria = { area_id: area, ...(language ? { language } : {}) }
  const providers = useNetworkRead(`referral-providers:${request.id}:${area}:${language}:${page}`,
    signal => getReferralServiceProviders(request.id, request.category_id, criteria, page, signal), area.length > 0)
  const chosen = providers.data?.items.find(item => item.user_code === selected)
  const fresh = !providers.error && !providers.checking && !providers.stale
  function clearSelection() { setSelected(null); setChecked(false) }
  function save() {
    if (!fresh || disabled || !area || !chosen || !relationship || (manager && !checked)) return
    submit({
      action: 'create', submission_id: crypto.randomUUID(), request_id: request.id,
      criteria, provider_user_code: chosen.user_code, relationship, share_confirmed: manager && checked,
    })
  }
  return <form className="space-y-4 rounded-xl border border-line bg-white p-4" onSubmit={event => {
    event.preventDefault(); save()
  }}>
    <h3 className="font-semibold">{t(manager ? 'referrals.new_offer' : 'referrals.new_suggestion')}</h3>
    <fieldset className="min-w-0 space-y-4" disabled={disabled}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold">{t('service.matches.area')}
          <select className={NETWORK_FIELD} required value={area} onChange={event => {
            setArea(event.target.value); setPage(1); clearSelection()
          }}>
            <option value="">{t('referrals.choose_area')}</option>
            {options.areas.map(item => <option key={item.id} value={item.id}>{professionalLabel(item.label, i18n.language)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">{t('referrals.language_optional')}
          <select className={NETWORK_FIELD} value={language} onChange={event => {
            setLanguage(event.target.value); setPage(1); clearSelection()
          }}>
            <option value="">{t('referrals.any_language')}</option>
            {options.languages.map(item => <option key={item.id} value={item.id}>{professionalLabel(item.label, i18n.language)}</option>)}
          </select>
        </label>
      </div>
      {area ? <NetworkFreshness read={providers} /> : null}
      {providers.error ? <p role="alert">{t(networkError(providers.error))}</p> : null}
      {providers.data ? <fieldset className="min-w-0 space-y-2" disabled={!fresh}>
        <legend className="font-semibold">{t('referrals.choose_provider')}</legend>
        {providers.data.items.length ? providers.data.items.map(provider =>
          <label key={provider.user_code} className="flex min-h-11 min-w-0 items-center gap-3 text-sm">
            <input type="radio" name="referral-provider" checked={provider.user_code === selected} onChange={() => {
              setSelected(provider.user_code); setChecked(false)
            }} />
            <span className="min-w-0 break-words">{provider.member_alias}</span>
          </label>) : <p role="status" className="text-sm">{t('referrals.no_matches')}</p>}
        <NetworkPagination page={page} total={providers.data.total} busy={!fresh} onChange={next => {
          setPage(next); clearSelection()
        }} />
      </fieldset> : null}
      <label className="block text-sm font-semibold">{t('referrals.relationship')}
        <select className={NETWORK_FIELD} required value={relationship} onChange={event => {
          const value = relationships.find(item => item === event.target.value)
          setRelationship(value ?? ''); setChecked(false)
        }}>
          <option value="">{t('referrals.choose_relationship')}</option>
          {relationships.map(item => <option key={item} value={item}>{t('referrals.relationships.' + item)}</option>)}
        </select>
      </label>
      {chosen && manager ? <>
        <SharedBrief request={request} />
        <p className="break-words text-sm">{t('referrals.sharing_with', { name: chosen.member_alias })}</p>
        <label className="flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" checked={checked} required onChange={event => setChecked(event.target.checked)} />
          {t('referrals.share_ack')}
        </label>
      </> : chosen ? <p className="break-words text-sm">{t('referrals.suggestion_private')}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={NETWORK_PRIMARY} disabled={!fresh || !chosen || !relationship || (manager && !checked)}>
          {t(manager ? 'referrals.apply.offer' : 'referrals.send_suggestion')}
        </button>
        <button type="button" className={NETWORK_BUTTON} onClick={cancel}>{t('referrals.cancel')}</button>
      </div>
    </fieldset>
  </form>
}

export function ServiceReferrals({ request, options, blocked = false, openRequest, onChange }: {
  request?: ServiceRequest
  options: ProfessionalOptions
  blocked?: boolean
  openRequest?: (id: string) => void
  onChange?: () => void
}) {
  const { t } = useTranslation('property_network')
  const [open, setOpen] = useState(request === undefined)
  const [page, setPage] = useState(1)
  const [editor, setEditor] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const requestId = request?.id
  const load = (signal: AbortSignal): Promise<ReferralPage & { total: number }> => requestId
    ? getRequestReferrals(requestId, page, signal)
    : getReceivedServiceReferrals(page, signal)
  const read = useNetworkRead(`referrals:${requestId ?? 'received'}:${page}`, load, open)
  const denied = Boolean(read.error && networkError(read.error) === 'error_access')
  const mutation = useServiceAttempt(transport, load, () => {
    setEditor(false); setReview(null); read.refresh(); onChange?.()
  }, () => {
    setReview(null); read.refresh()
  }, denied)
  const fresh = Boolean(read.data && !read.checking && !read.stale && !read.error)
  const unavailable = !fresh || blocked || mutation.denied || mutation.pending !== null || mutation.busy
  const manager = request?.view === 'managed'
  const canRefer = manager ? read.data?.can_offer === true : read.data?.can_suggest === true
  const current = review ? read.data?.items.find(item => item.id === review.referral.id) : undefined
  const reviewCurrent = Boolean(current && review && current.version === review.referral.version
    && allowed(current, review.action))
  useNetworkDraftGuard(mutation.pending !== null, mutation.busy)
  function confirmReview() {
    if (!review || unavailable || !reviewCurrent) return
    mutation.send({
      action: review.action, referral_id: review.referral.id, expected_version: review.referral.version,
      submission_id: crypto.randomUUID(),
    })
  }
  return <NetworkPanel title={t(request ? 'referrals.title' : 'referrals.received')}>
    {request ? <button type="button" className={NETWORK_BUTTON} aria-expanded={open} disabled={mutation.pending !== null}
      onClick={() => { setOpen(!open); setEditor(false); setReview(null) }}>{t(open ? 'referrals.hide' : 'referrals.show')}</button> : null}
    {open ? <div className="mt-4 min-w-0 space-y-4">
      <NetworkFreshness read={read} />
      {read.error ? <p role="alert">{t(networkError(read.error))}</p> : null}
      {!request && !denied ? <p className="text-sm">{t('referrals.inbox_help')}</p> : null}
      {!denied && read.data ? <>
        {request && canRefer && !editor && !review ? <button type="button" className={NETWORK_PRIMARY} disabled={unavailable}
          onClick={() => setEditor(true)}>{t(manager ? 'referrals.new_offer' : 'referrals.new_suggestion')}</button> : null}
        {editor && request ? <ReferralEditor request={request} options={options} manager={manager}
          disabled={unavailable || !canRefer} cancel={() => setEditor(false)} submit={mutation.send} /> : null}
        {review ? <ReferralConfirmation key={review.referral.id + ':' + review.action} current={review} request={request}
          disabled={unavailable || !reviewCurrent} cancel={() => setReview(null)} confirm={confirmReview} /> : null}
        {review && !reviewCurrent ? <p role="status" className="text-sm">{t('referrals.changed')}</p> : null}
        <div className="grid min-w-0 gap-3 md:grid-cols-2">
          {read.data.items.map(item => <ReferralCard key={item.id} referral={item} options={options}
            disabled={unavailable || editor || review !== null} openRequest={openRequest}
            review={(referral, action) => setReview({ referral, action })} />)}
        </div>
        {read.data.items.length === 0 ? <p role="status" className="text-sm">{t('referrals.empty')}</p> : null}
        <NetworkPagination page={page} total={read.data.total} busy={unavailable || editor || review !== null} onChange={setPage} />
      </> : !read.error ? <p role="status">{t('loading')}</p> : null}
      <ServiceMutationStatus mutation={mutation} />
    </div> : null}
  </NetworkPanel>
}
