import { useEffect, useState } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '../../components/dashboard/shared'
import { InquiryHistory } from '../../components/dashboard/InquiryHistory'
import { getMyLeads, type Lead } from '../../api/leads'
import { currentBuyerInquiries, inquiryDate, inquiryStatus } from '../../utils/inquiryFeeds'
import { landingBaseUrl } from '../../lib/siteUrls'

const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)

export function Inquiries() {
  const { t, i18n } = useTranslation('inquiry_feeds')
  const [inquiries, setInquiries] = useState<Lead[] | null>(null)
  const [busy, setBusy] = useState(true)
  const [failed, setFailed] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [visible, setVisible] = useState(20)
  useEffect(() => {
    const controller = new AbortController()
    setInquiries(null); setBusy(true); setFailed(false); setVisible(20)
    getMyLeads(controller.signal).then(result => { if (!controller.signal.aborted) setInquiries(currentBuyerInquiries(result)) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [refresh])
  return <div className="space-y-5">
    <Card title={<><MessageCircle size={15} />{t('buyer_title')}</>}>
      <p className="mb-4 text-sm leading-relaxed text-ink2">{t('buyer_explanation')}</p>
      {busy ? <p role="status" className="py-6 text-sm text-dim">{t('loading')}</p> : failed ? <div role="alert"><p className="text-sm text-red-900">{t('current_error')}</p><button type="button" onClick={() => setRefresh(value => value + 1)} className="mt-2 min-h-10 text-sm font-semibold text-sea underline">{t('retry')}</button></div> : inquiries ? <>
        <p className="mb-3 text-xs text-dim">{t('buyer_count', { count: inquiries.length })}</p>
        {!inquiries.length ? <div className="space-y-3 py-5"><p className="text-sm text-ink2">{t('buyer_empty')}</p><a href={`${LANDING_URL}/search/`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-sea px-3 text-sm font-semibold text-white no-underline"><Search size={15} aria-hidden="true" />{t('browse')}</a></div> : <ul className="divide-y divide-line">{inquiries.slice(0, visible).map(lead => <li key={`lead:${lead.id}`} className="space-y-2 py-4 first:pt-0"><div className="flex flex-wrap justify-between gap-2"><h3 className="break-words text-sm font-bold text-ink">{lead.property_title || t('property_unavailable')}</h3><span className="rounded-full bg-line-soft px-2.5 py-1 text-xs font-semibold text-ink">{t(`statuses.${inquiryStatus(lead.status)}`)}</span></div><p className="whitespace-pre-wrap break-words text-sm text-ink2">{lead.message || t('no_message')}</p><p className="text-xs text-dim">{inquiryDate(lead.created_at, i18n.language)}</p></li>)}</ul>}
        {visible < inquiries.length ? <button type="button" onClick={() => setVisible(value => value + 20)} className="mt-3 min-h-10 text-sm font-semibold text-sea underline">{t('show_more')}</button> : null}
      </> : null}
    </Card>
    <InquiryHistory scope="buyer" />
  </div>
}
