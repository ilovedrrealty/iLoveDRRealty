import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getMyInquiries, getOwnerInquiries, type Inquiry } from '../../api/inquiries'
import { inquiryContacts, inquiryDate } from '../../utils/inquiryFeeds'

export function InquiryContactActions({ phone, email, tone = '#0b63ab' }: { phone: string | null; email: string | null; tone?: string }) {
  const { t } = useTranslation('inquiry_feeds')
  const actions = inquiryContacts(phone, email)
  const actionColor = tone.toLowerCase() === '#f0a800' ? '#241b00' : '#fff'
  return <div className="flex flex-wrap items-center gap-2">
    {actions.phone ? <a href={actions.phone} className="inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-xs font-bold no-underline" style={{ background: tone, color: actionColor }}>{t('call_preferred')}</a> : null}
    {actions.email ? <a href={actions.email} className="inline-flex min-h-10 items-center rounded-lg border border-line px-3 py-2 text-xs font-semibold text-ink no-underline" style={actions.phone ? undefined : { background: tone, color: actionColor }}>{t('email')}</a> : null}
    {!actions.phone && !actions.email ? <span className="text-xs text-dim">{t('no_contact_action')}</span> : null}
  </div>
}

export function InquiryHistory({ scope }: { scope: 'buyer' | 'owner' }) {
  const { t, i18n } = useTranslation('inquiry_feeds')
  const [expanded, setExpanded] = useState(false)
  const [rows, setRows] = useState<Inquiry[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [visible, setVisible] = useState(20)
  useEffect(() => {
    if (!expanded) return
    const controller = new AbortController()
    setBusy(true); setFailed(false); setRows(null); setVisible(20)
    const read = scope === 'owner' ? getOwnerInquiries : getMyInquiries
    read(controller.signal).then(result => {
      if (!controller.signal.aborted) setRows(result.slice().sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)))
    }).catch(() => { if (!controller.signal.aborted) setFailed(true) })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [expanded, scope, refresh])
  return <section className="rounded-xl border border-line bg-paper p-4 sm:p-5">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="text-left text-sm font-bold text-ink underline">{t('history_title')}</button>
    <p className="mt-2 text-xs leading-relaxed text-ink2">{t('history_explanation')}</p>
    {expanded ? <div className="mt-4">
      {busy ? <p role="status" className="text-sm text-dim">{t('loading')}</p> : failed ? <div role="alert"><p className="text-sm text-red-800">{t('history_error')}</p><button type="button" className="mt-2 min-h-10 text-sm font-semibold text-sea underline" onClick={() => setRefresh(value => value + 1)}>{t('retry')}</button></div> : rows ? <>
        <p className="mb-3 text-xs text-dim">{t('history_count', { count: rows.length })}</p>
        {!rows.length ? <p className="text-sm text-dim">{t('history_empty')}</p> : <ul className="divide-y divide-line">{rows.slice(0, visible).map(row => <li key={`legacy:${row.id}`} className="space-y-2 py-4 first:pt-0">
          <div className="flex flex-wrap justify-between gap-2"><h3 className="text-sm font-bold text-ink">{row.listing_title || t('property_unavailable')}</h3><span className="text-xs text-dim">{t('history_source')}</span></div>
          {scope === 'owner' ? <p className="text-sm text-ink">{row.name}</p> : null}
          <p className="whitespace-pre-wrap break-words text-sm text-ink2">{row.message || t('no_message')}</p>
          <p className="text-xs text-dim">{inquiryDate(row.created_at, i18n.language)}</p>
          {scope === 'owner' ? <><p className="break-words text-xs text-dim">{[row.phone, row.email].filter(Boolean).join(' · ')}</p><InquiryContactActions phone={row.phone} email={row.email} /></> : null}
        </li>)}</ul>}
        {visible < rows.length ? <button type="button" className="mt-3 min-h-10 text-sm font-semibold text-sea underline" onClick={() => setVisible(value => value + 20)}>{t('show_more')}</button> : null}
      </> : null}
    </div> : null}
  </section>
}
