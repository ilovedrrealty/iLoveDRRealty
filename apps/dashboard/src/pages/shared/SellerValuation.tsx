import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  addValuationAsking, addValuationSold, completeValuationFollowUp, getSellerValuation, removeValuationComparable,
  reviewSellerValuation, reviewValuationSold, saveSellerValuation, scheduleValuationFollowUp, valuationAccessDenied,
  valuationErrorStatus, valuationEvidenceCounts,
  type ValuationSoldDecision, type ValuationWorkspace,
} from '../../api/sellerValuation'
import { allowNetworkNavigation, useNetworkDraftGuard } from '../../components/network/NetworkShared'
import { ProfessionalConfirmation } from '../../components/shared/ProfessionalConfirmation'
import { ProfessionalDialog } from '../../components/shared/ProfessionalDialog'
import { AskingComparablePicker, SoldComparableForm, ValuationEvidence } from '../../components/shared/SellerValuationEvidence'
import {
  factsFromFields, subjectToFields, ValuationFactsSummary, ValuationSubjectFacts,
  valuationButton, valuationError, valuationPanel, valuationPrimary,
} from '../../components/shared/SellerValuationFields'
import {
  SoldReviewForm, ValuationFollowUpForm, ValuationFollowUps, ValuationReportForm, ValuationReportPanel,
} from '../../components/shared/SellerValuationReview'
import { useNetworkRead } from '../../hooks/useNetworkRead'

type Problem = 'conflict' | 'validation' | 'uncertain'
type Dialog =
  | { kind: 'asking' | 'sold' | 'report' | 'follow' }
  | { kind: 'sold_review'; id: string; decision: ValuationSoldDecision }
  | { kind: 'remove' | 'complete'; id: string }

export function SellerValuation({ leadId }: { leadId: string }) {
  return <ValuationAccess key={leadId} leadId={leadId} />
}

function ValuationAccess({ leadId }: { leadId: string }) {
  const { t } = useTranslation('seller_valuation')
  const [generation, setGeneration] = useState(0)
  const [denied, setDenied] = useState(false)
  const read = useNetworkRead(`valuation:${leadId}:${generation}`, signal => getSellerValuation(leadId, signal), !denied)
  const onDenied = useCallback(() => setDenied(true), [])
  function reload() {
    setDenied(false)
    setGeneration(value => value + 1)
  }
  const current = read.data?.lead_id === leadId ? read.data : null
  return <div className="min-w-0 max-w-5xl space-y-4 pb-10">
    <h1 className="text-2xl font-bold text-ink">{t('heading')}</h1>
    {current && !denied
      ? <ValuationWorkspaceEditor key={generation} observed={current} unavailable={read.stale || !!read.error}
          onReload={reload} onDenied={onDenied} refreshAccess={read.refresh} />
      : denied || read.error || read.data
        ? <div className={valuationError}>
            <p role="alert">{t(denied || valuationAccessDenied(read.error) || read.data ? 'errors.access' : 'errors.read')}</p>
            <button type="button" className={`${valuationButton} mt-2`} onClick={reload}>{t('retry')}</button>
          </div>
        : <p role="status" className="text-sm text-ink2">{t('loading')}</p>}
  </div>
}

function ValuationWorkspaceEditor({ observed, unavailable, onReload, onDenied, refreshAccess }: {
  observed: ValuationWorkspace; unavailable: boolean
  onReload: () => void; onDenied: () => void; refreshAccess: () => void
}) {
  const { t } = useTranslation('seller_valuation')
  const [saved, setSaved] = useState(observed)
  const [fields, setFields] = useState(() => subjectToFields(observed.subject))
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogDirty, setDialogDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [busy, setBusy] = useState(false)
  const active = useRef<AbortController | null>(null)
  useEffect(() => () => active.current?.abort(), [])
  const dirty = JSON.stringify(fields) !== JSON.stringify(subjectToFields(saved.subject))
  const conflict = observed.version > saved.version || problem === 'conflict'
  const frozen = conflict || problem === 'uncertain'
  const inactive = frozen || unavailable || busy
  const actionDisabled = inactive || !saved.started || dirty
  const counts = valuationEvidenceCounts(saved.comparables)
  const rangeEligible = Boolean(saved.subject.property_type && saved.subject.location && (counts.asking > 0 || counts.sold > 0))
  useNetworkDraftGuard(dirty || dialogDirty, busy)

  async function write(request: (signal: AbortSignal) => Promise<ValuationWorkspace>, message: string) {
    if (active.current || inactive) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    setNotice('')
    setProblem(null)
    try {
      const result = await request(controller.signal)
      if (controller.signal.aborted) return
      if (result.lead_id !== saved.lead_id) {
        onDenied()
        return
      }
      setSaved(result)
      setFields(subjectToFields(result.subject))
      setDialog(null)
      setDialogDirty(false)
      setNotice(message)
      refreshAccess()
    } catch (error) {
      if (controller.signal.aborted) return
      if (valuationAccessDenied(error)) onDenied()
      else {
        const status = valuationErrorStatus(error)
        setProblem(status === 409 ? 'conflict' : status === 400 || status === 422 ? 'validation' : 'uncertain')
      }
    } finally {
      if (active.current === controller) active.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  function open(next: Dialog) {
    if (actionDisabled) return
    setProblem(null)
    setDialog(next)
  }
  function close() {
    if (active.current || (dialogDirty && !window.confirm(t('discard_dialog')))) return
    setDialog(null)
    setDialogDirty(false)
    if (problem === 'validation') setProblem(null)
  }
  function reload() {
    if (!active.current && allowNetworkNavigation()) onReload()
  }

  const warning = conflict ? t('errors.conflict') : problem ? t(`errors.${problem}`) : unavailable ? t('errors.freshness') : ''
  const status = warning && <div className={valuationError}>
    <p role="alert">{warning}</p>
    {frozen
      ? <button type="button" disabled={busy} className={`${valuationButton} mt-2`} onClick={reload}>{t('reload')}</button>
      : unavailable && <button type="button" className={`${valuationButton} mt-2`} onClick={refreshAccess}>{t('retry')}</button>}
  </div>
  const dialogTitle = dialog?.kind === 'sold_review'
    ? t(dialog.decision === 'verified' ? 'sold.verify' : 'sold.reject')
    : dialog && t(`dialogs.${dialog.kind}`)
  const markDirty = () => setDialogDirty(true)

  return <>
    {!dialog && status}
    {notice && <p role="status" className="text-sm font-semibold text-sea">{t(notice)}</p>}
    <section className={valuationPanel}>
      <h2 className="text-lg font-bold text-ink">{t('subject.heading')}</h2>
      <p className="text-sm text-ink2">{t('subject.help')}</p>
      {saved.intake_subject && <div className="min-w-0 space-y-1 rounded-lg bg-paper p-3">
        <h3 className="text-sm font-semibold text-ink">{t('subject.intake')}</h3>
        <ValuationFactsSummary facts={saved.intake_subject} />
        {saved.intake_subject.condition && <p className="text-sm text-ink2">{t(`conditions.${saved.intake_subject.condition}`)}</p>}
      </div>}
      <form onSubmit={event => {
        event.preventDefault()
        const subject = { ...factsFromFields(fields), condition: fields.condition || null }
        if (!saved.started || dirty) void write(signal => saveSellerValuation(saved.lead_id, saved.version, subject, signal), 'subject.saved')
      }}>
        <fieldset className="min-w-0 space-y-3" disabled={inactive}>
          <ValuationSubjectFacts fields={fields} change={setFields} />
          <button type="submit" className={valuationPrimary} disabled={saved.started && !dirty}>
            {t(saved.started ? 'subject.save' : 'subject.start')}
          </button>
        </fieldset>
      </form>
    </section>
    {dirty && saved.started && <p className="text-sm text-ink2">{t('subject.save_before_next')}</p>}
    {saved.started && <>
      <ValuationEvidence comparables={saved.comparables} disabled={actionDisabled}
        onAsking={() => open({ kind: 'asking' })} onSold={() => open({ kind: 'sold' })}
        onSoldReview={(id, decision) => open({ kind: 'sold_review', id, decision })}
        onRemove={id => open({ kind: 'remove', id })} />
      <ValuationReportPanel review={saved.review} counts={counts} disabled={actionDisabled} onReview={() => open({ kind: 'report' })} />
      <ValuationFollowUps items={saved.follow_ups} disabled={actionDisabled}
        onSchedule={() => open({ kind: 'follow' })} onComplete={id => open({ kind: 'complete', id })} />
    </>}
    {dialog && dialogTitle && <ProfessionalDialog title={dialogTitle} closeLabel={t('close_dialog')} onClose={close}>
      <div className="min-w-0 space-y-3">
        {status}
        {dialog.kind === 'asking' && <AskingComparablePicker leadId={saved.lead_id} propertyType={saved.subject.property_type ?? ''}
          captured={new Set(saved.comparables.flatMap(item => item.listing_id ? [item.listing_id] : []))}
          disabled={inactive} onDenied={onDenied} onAdd={listingId => void write(signal => addValuationAsking(saved.lead_id, saved.version, listingId, signal), 'asking.added')} />}
        {dialog.kind === 'sold' && <SoldComparableForm disabled={inactive} markDirty={markDirty}
          onSubmit={value => void write(signal => addValuationSold(saved.lead_id, saved.version, value, signal), 'sold.added')} />}
        {dialog.kind === 'sold_review' && <SoldReviewForm decision={dialog.decision} disabled={inactive} markDirty={markDirty}
          onSubmit={note => void write(signal => reviewValuationSold(saved.lead_id, saved.version, dialog.id, dialog.decision, note, signal), 'sold.reviewed')} />}
        {dialog.kind === 'report' && <ValuationReportForm counts={counts} rangeEligible={rangeEligible} disabled={inactive} markDirty={markDirty}
          onSubmit={report => void write(signal => reviewSellerValuation(saved.lead_id, saved.version, report, signal), 'report.saved')} />}
        {dialog.kind === 'follow' && <ValuationFollowUpForm disabled={inactive} markDirty={markDirty}
          onSubmit={(date, note) => void write(signal => scheduleValuationFollowUp(saved.lead_id, saved.version, date, note, signal), 'follow.scheduled')} />}
        {(dialog.kind === 'remove' || dialog.kind === 'complete') && <ProfessionalConfirmation
          message={t(dialog.kind === 'remove' ? 'evidence.confirm_remove' : 'follow.confirm_complete')}
          confirmLabel={t(dialog.kind === 'remove' ? 'evidence.remove' : 'follow.complete')} cancelLabel={t('cancel')} busy={inactive}
          onCancel={close} onConfirm={() => dialog.kind === 'remove'
            ? void write(signal => removeValuationComparable(saved.lead_id, saved.version, dialog.id, signal), 'evidence.removed')
            : void write(signal => completeValuationFollowUp(saved.lead_id, saved.version, dialog.id, signal), 'follow.completed_now')} />}
      </div>
    </ProfessionalDialog>}
  </>
}
