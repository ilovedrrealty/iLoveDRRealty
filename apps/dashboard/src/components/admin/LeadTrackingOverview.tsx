import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getLeadTrackingSummary, type Lead, type LeadTrackingSummary } from '../../api/leads'

const copy = {
  en: { heading: 'Inquiry tracking · last 30 days', leads: 'Inquiries', tagged: 'With ad click reference', tests: 'Marked internal tests', errors: 'CRM sync errors', linked: 'CRM linked', detail: 'Source and measurement', none: 'Not provided', notice: 'These are website records, not Google Ads conversion totals. Older records have unknown tracking/test status. Test inquiries are excluded from intent and ad-reference counts.', retry: 'Retry tracking summary', failed: 'Tracking summary unavailable. Your lead list is still available.', consent: 'Measurement choice', granted: 'Allowed', denied: 'Declined', unset: 'Not selected', form: 'Form', campaign: 'Campaign', source: 'Source / medium', click: 'Ad click reference saved', yes: 'Yes', no: 'No', test: 'Internal test — excluded from advertising conversion measurement', eligible: 'Eligible inquiry event; Google Ads attribution is separate.', excluded: 'Excluded from the advertising conversion.' },
  es: { heading: 'Seguimiento de consultas · últimos 30 días', leads: 'Consultas', tagged: 'Con referencia de clic publicitario', tests: 'Pruebas internas marcadas', errors: 'Errores de sincronización CRM', linked: 'Vinculadas al CRM', detail: 'Fuente y medición', none: 'No indicado', notice: 'Son registros del sitio, no totales de conversiones de Google Ads. Los registros anteriores tienen estado de seguimiento/prueba desconocido. Las pruebas se excluyen de los conteos por intención y referencia publicitaria.', retry: 'Reintentar resumen', failed: 'Resumen no disponible. La lista de consultas sigue disponible.', consent: 'Preferencia de medición', granted: 'Permitida', denied: 'Rechazada', unset: 'Sin elegir', form: 'Formulario', campaign: 'Campaña', source: 'Fuente / medio', click: 'Referencia de clic guardada', yes: 'Sí', no: 'No', test: 'Prueba interna — excluida de la conversión publicitaria de consultas', eligible: 'Evento de consulta elegible; la atribución de Google Ads es independiente.', excluded: 'Excluida de la conversión publicitaria de consultas.' },
}
const intentLabels = {
  en: { buy: 'Buying', sell: 'Selling', rent: 'Renting', general: 'General inquiry', unknown: 'Unknown' },
  es: { buy: 'Comprar', sell: 'Vender', rent: 'Alquilar', general: 'Consulta general', unknown: 'Desconocida' },
}

export function LeadTrackingOverview() {
  const { i18n } = useTranslation()
  const c = copy[i18n.language.startsWith('es') ? 'es' : 'en']
  const [summary, setSummary] = useState<LeadTrackingSummary | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setFailed(false)
    getLeadTrackingSummary().then(value => { if (active) setSummary(value) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [revision])
  if (!summary && !failed) return null
  return <section className="mb-5 rounded-xl border border-line bg-white p-4" aria-label={c.heading}>
    <h2 className="text-sm font-bold text-ink">{c.heading}</h2>
    {failed ? <div className="mt-2 text-xs text-dim" role="status">{c.failed} <button type="button" className="underline" onClick={() => setRevision(value => value + 1)}>{c.retry}</button></div> : summary && <>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">{[[c.leads, summary.total], [c.tagged, summary.with_ad_click_id], [c.tests, summary.internal_tests], [c.linked, summary.crm_linked], [c.errors, summary.crm_errors]].map(([label, count]) => <div key={label} className="rounded-lg bg-paper2 p-2"><dt className="text-xs text-dim">{label}</dt><dd className="mt-1 text-lg font-bold text-ink">{count}</dd></div>)}</dl>
      <p className="mt-3 text-xs leading-relaxed text-dim">{c.notice}</p>
    </>}
  </section>
}

export function LeadTrackingDetails({ lead }: { lead: Lead }) {
  const { i18n } = useTranslation()
  const c = copy[i18n.language.startsWith('es') ? 'es' : 'en']
  const data = lead.tracking_summary
  if (!data) return null
  const language = i18n.language.startsWith('es') ? 'es' : 'en'
  return <section className="rounded-xl border border-line bg-white p-4" aria-label={c.detail}>
    <h3 className="text-xs font-bold text-ink">{c.detail}</h3>
    <p className="mt-2 text-xs text-ink"><strong>{language === 'es' ? 'Intención de la consulta' : 'Inquiry intent'}:</strong> {intentLabels[language][data.intent] || intentLabels[language].unknown}</p>
    {data.internal_test && <p className="mt-2 text-xs font-semibold text-amber-800">{c.test}</p>}
    <dl className="mt-3 space-y-2 text-xs">{[[c.form, data.form], [c.source, [data.source, data.medium].filter(Boolean).join(' / ') || c.none], [c.campaign, data.campaign || c.none], [c.consent, c[data.measurement_consent]], [c.click, data.has_ad_click_id ? c.yes : c.no]].map(([label, value]) => <div key={label}><dt className="font-semibold text-dim">{label}</dt><dd className="mt-0.5 break-words text-ink">{value}</dd></div>)}</dl>
    <p className="mt-3 text-xs leading-relaxed text-dim">{data.measurement.eligible ? c.eligible : c.excluded}</p>
  </section>
}
