import { lazy, Suspense, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { allowNetworkNavigation } from '../../components/network/NetworkShared'

const SellerValuation = lazy(() => import('./SellerValuation').then(module => ({ default: module.SellerValuation })))

export function SellerValuationLead({ leadId, onBack }: { leadId: string; onBack: () => void }) {
  const { t } = useTranslation('seller_valuation')
  const back = useRef<HTMLButtonElement>(null)
  useEffect(() => { back.current?.focus() }, [leadId])

  return <div className="min-w-0 space-y-4">
    <button ref={back} type="button"
      className="min-h-11 rounded-lg border border-line bg-paper px-3 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-coral"
      onClick={() => { if (allowNetworkNavigation()) onBack() }}>{t('back_to_lead')}</button>
    <Suspense fallback={<p role="status" className="text-sm text-dim">{t('loading')}</p>}>
      <SellerValuation key={leadId} leadId={leadId} />
    </Suspense>
  </div>
}
