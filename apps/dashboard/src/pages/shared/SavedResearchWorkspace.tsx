import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { CheckSquare, ExternalLink, Plus, Printer, Save, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { CHECKLIST_ITEMS } from '../../data/researchTools'
import { emptyResearchData, getResearchWorkspace, listResearchWorkspaces, saveResearchWorkspace, safeResearchUrl, type ResearchData, type ResearchSummary } from '../../api/researchWorkspaces'

const FIELD = 'w-full rounded-lg border border-line bg-white px-3 py-2.5 text-[13px] text-ink outline-none focus:border-sea disabled:opacity-60'
const BUTTON = 'inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[12px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-default'

export function SavedResearchWorkspace() {
  const { t, i18n } = useTranslation('research_tools')
  const [items, setItems] = useState<ResearchSummary[]>([])
  const [current, setCurrent] = useState<ResearchSummary | null>(null)
  const [data, setData] = useState<ResearchData>(emptyResearchData)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(true)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setBusy(true)
    listResearchWorkspaces(controller.signal).then(rows => {
      if (controller.signal.aborted) return
      setItems(rows); setReady(true); setError('')
    }).catch(() => { if (!controller.signal.aborted) { setError('load_error'); setReady(false) } })
      .finally(() => { if (!controller.signal.aborted) setBusy(false) })
    return () => controller.abort()
  }, [reload])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function update(next: Partial<ResearchData>) {
    setData(previous => ({ ...previous, ...next })); setDirty(true); setMessage(''); setError('')
  }
  async function open(id: string) {
    setBusy(true); setError(''); setMessage('')
    try {
      if (id) {
        const row = await getResearchWorkspace(id)
        setCurrent(row); setData(row.data)
      } else { setCurrent(null); setData(emptyResearchData()) }
      setDirty(false)
    } catch { setError('load_error') }
    finally { setBusy(false) }
  }
  async function save() {
    setBusy(true); setError(''); setMessage('')
    try {
      const row = await saveResearchWorkspace(data, current)
      setCurrent(row); setData(row.data); setDirty(false); setMessage('saved')
      setItems(previous => [row, ...previous.filter(item => item.id !== row.id)])
    } catch (failure) {
      setError(isAxiosError(failure) && failure.response?.status === 409 ? 'conflict' : 'save_error')
    } finally { setBusy(false) }
  }
  const completed = CHECKLIST_ITEMS.filter(id => data.checks[id]).length
  const savedAt = current ? new Date(current.updated_at).toLocaleString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US') : ''
  return (
    <section className="rounded-2xl border border-line bg-paper p-5 research-tools-card" aria-labelledby="due-diligence-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="due-diligence-heading" className="text-[16px] font-bold text-ink flex items-center gap-2 m-0"><CheckSquare size={18} />{t('checklist.title')}</h2>
        <button type="button" onClick={() => window.print()} className={`${BUTTON} research-no-print`}><Printer size={14} />{t('checklist.print')}</button>
      </div>
      <p className="text-[12.5px] text-dim leading-relaxed mt-2 mb-3">{t('saved.intro')}</p>
      <p className="rounded-lg bg-sea/5 border border-sea/15 px-3 py-2.5 text-[12px] leading-relaxed">{t('saved.privacy')}</p>
      <div className="research-no-print space-y-3">
        <label className="block text-[12px] font-semibold text-ink2">{t('saved.select')}
          <select value={current?.id ?? ''} disabled={busy || dirty || !ready} onChange={event => void open(event.target.value)} className={`${FIELD} mt-1.5`}>
            <option value="">{t('saved.new')}</option>{items.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </label>
        {error && <div role="alert" className="text-[12px] text-red-700"><p>{t(`saved.${error}`)}</p>{!ready && <button type="button" disabled={busy} onClick={() => setReload(value => value + 1)} className={BUTTON}>{t('directory.retry')}</button>}</div>}
        <fieldset disabled={busy || !ready} className="border-0 p-0 m-0 min-w-0 space-y-3">
          <label className="block text-[12px] font-semibold text-ink2">{t('saved.title')}<input value={data.title} onChange={event => update({ title: event.target.value })} maxLength={160} required className={`${FIELD} mt-1.5`} /></label>
          <label className="block text-[12px] font-semibold text-ink2">{t('saved.reference')}<input value={data.reference} onChange={event => update({ reference: event.target.value })} maxLength={200} className={`${FIELD} mt-1.5`} /></label>
          <label className="block text-[12px] font-semibold text-ink2">{t('saved.notes')}<textarea value={data.notes} onChange={event => update({ notes: event.target.value })} maxLength={3000} rows={3} className={`${FIELD} mt-1.5 resize-y`} /></label>
        </fieldset>
      </div>
      <div className="hidden print:block"><h3>{data.title}</h3><p>{data.reference}</p><p className="whitespace-pre-wrap">{data.notes}</p></div>
      <p className="text-[12px] font-semibold text-ink2" aria-live="polite">{t('checklist.progress', { done: completed, total: CHECKLIST_ITEMS.length })}</p>
      <fieldset disabled={busy || !ready} className="flex flex-col divide-y divide-line p-0 m-0 border-0 min-w-0">
        {CHECKLIST_ITEMS.map(id => <div key={id} className="py-3 research-tools-card">
          <label className="flex items-start gap-2.5 text-[13px] font-semibold text-ink cursor-pointer">
            <input type="checkbox" checked={!!data.checks[id]} onChange={event => update({ checks: { ...data.checks, [id]: event.target.checked } })} className="mt-0.5 h-4 w-4 accent-sea shrink-0" /><span>{t(`checklist.items.${id}`)}</span>
          </label>
          <label className="block mt-2 ml-6.5 text-[11.5px] text-dim research-no-print">{t('checklist.note_label', { item: t(`checklist.items.${id}`) })}
            <textarea value={data.item_notes[id] ?? ''} onChange={event => update({ item_notes: { ...data.item_notes, [id]: event.target.value } })} maxLength={1000} rows={2} className={`${FIELD} mt-1 resize-y`} placeholder={t('checklist.note_placeholder')} />
          </label>
          {data.item_notes[id] && <p className="hidden print:block whitespace-pre-wrap text-[12px] ml-6.5">{data.item_notes[id]}</p>}
        </div>)}
      </fieldset>
      <div className="mt-4 border-t border-line pt-4">
        <h3 className="text-[14px] font-bold mt-0">{t('saved.links')}</h3>
        <p className="text-[12px] text-dim">{t('saved.links_help')}</p>
        {data.links.map((link, index) => <div key={index} className="mb-3 rounded-xl border border-line p-3">
          <fieldset disabled={busy || !ready} className="research-no-print grid gap-2 border-0 m-0 p-0">
            <label className="text-[12px]">{t('saved.link_title')}<input value={link.title} maxLength={120} onChange={event => update({ links: data.links.map((item, i) => i === index ? { ...item, title: event.target.value } : item) })} className={`${FIELD} mt-1`} /></label>
            <label className="text-[12px]">{t('saved.link_url')}<input type="url" value={link.url} maxLength={800} placeholder="https://" onChange={event => update({ links: data.links.map((item, i) => i === index ? { ...item, url: event.target.value } : item) })} className={`${FIELD} mt-1`} /></label>
            <button type="button" onClick={() => update({ links: data.links.filter((_, i) => i !== index) })} className={`${BUTTON} justify-self-start`}><Trash2 size={13} />{t('saved.remove')}</button>
          </fieldset>
          {safeResearchUrl(link.url) && <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] text-sea underline mt-2 break-all">{link.title || t('saved.open_link')}<ExternalLink size={13} /></a>}
        </div>)}
        <button type="button" disabled={busy || !ready || data.links.length >= 10} onClick={() => update({ links: [...data.links, { title: '', url: '' }] })} className={`${BUTTON} research-no-print`}><Plus size={14} />{t('saved.add_link')}</button>
      </div>
      <div className="research-no-print mt-5 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !ready || !dirty || !data.title.trim()} onClick={() => void save()} className={`${BUTTON} bg-sea text-white border-sea`}><Save size={14} />{t(busy && dirty ? 'saved.saving' : 'saved.save')}</button>
        {dirty && <button type="button" disabled={busy} onClick={() => void open(current?.id ?? '')} className={`${BUTTON} text-ink2`}>{t('saved.discard')}</button>}
        <p role="status" className="text-[12px] text-dim m-0">{message ? t(`saved.${message}`) : busy ? t('saved.loading') : dirty ? t('saved.unsaved') : current ? t('saved.saved_at', { date: savedAt }) : t('saved.start')}</p>
      </div>
      <p className="text-[11.5px] text-dim leading-relaxed mb-0">{t('checklist.limit')}</p>
    </section>
  )
}
