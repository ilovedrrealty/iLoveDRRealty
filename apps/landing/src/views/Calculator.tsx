'use client'
import { useNav } from '../hooks/useNav'
import { createContext, useContext, useId, useState, useMemo, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ROI_TAX_SOURCES, ROI_PAYBACK_SCALE_YEARS, ROI_PAYBACK_TICKS, calculateRoi, copyRoiLink, isRoiState, readRoiFragment, roiNetBar, roiSimplePaybackScale, roiWhatsAppUrl, type RoiLocale, type RoiState } from '../lib/roiCalculator'

type Scenario = 'rent' | 'vacation' | 'flip'
type Financing = 'mortgage' | 'cash' | 'hard' | 'seller'

function fmt(n: number): string {
  if (!isFinite(n)) return '—'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000_000) return sign + '$' + (abs / 1_000_000_000_000).toFixed(1) + 'T'
  if (abs >= 1_000_000_000) return sign + '$' + (abs / 1_000_000_000).toFixed(1) + 'B'
  if (abs >= 1_000_000) return sign + '$' + (abs / 1_000_000).toFixed(1) + 'M'
  if (abs >= 1_000) return sign + '$' + Math.round(abs / 1_000) + 'K'
  return sign + '$' + abs.toLocaleString()
}
function pct(n: number | null) { return n !== null && isFinite(n) ? n.toFixed(1) + '%' : '—' }

const inputCls = 'w-full py-2.5 px-3 rounded-md border border-[#E2E8F0] font-sans text-sm text-[#0D1B3E] outline-none bg-white'

const FieldContext = createContext<{ labelId: string; hintId?: string } | null>(null)

function useFieldControl() {
  const id = useId()
  const field = useContext(FieldContext)
  if (!field) throw new Error('Calculator controls must be inside a Field')
  return { id, 'aria-labelledby': field.labelId, 'aria-describedby': field.hintId }
}

function NumberInput({ value, set, min, max, step = 1, prefix, suffix, disabled = false }: {
  value: number; set: (v: number) => void
  min?: number; max?: number; step?: number
  prefix?: string; suffix?: string; disabled?: boolean
}) {
  const control = useFieldControl()
  return (
    <div className="relative flex items-center">
      {prefix && <span aria-hidden="true" className="absolute left-3 text-[#556070] font-semibold text-sm pointer-events-none">{prefix}</span>}
      <input {...control} type="number" value={value} min={min} max={max} step={step} disabled={disabled}
        onChange={e => set(+e.target.value || 0)}
        className={inputCls}
        style={{ paddingLeft: prefix ? 26 : 12, paddingRight: suffix ? 36 : 12 }} />
      {suffix && <span aria-hidden="true" className="absolute right-3 text-[#556070] font-semibold text-3.25 pointer-events-none">{suffix}</span>}
    </div>
  )
}

function SelectInput({ value, set, options }: {
  value: string | number
  set: (v: string | number) => void
  options: [string | number, string][]
}) {
  const control = useFieldControl()
  return (
    <select {...control} value={value}
      onChange={e => set(isNaN(+e.target.value) ? e.target.value : +e.target.value)}
      className={`${inputCls} cursor-pointer`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function RangeInput({ label, value, set, min, max, step }: {
  label: string; value: number; set: (v: number) => void
  min: number; max: number; step: number
}) {
  const control = useFieldControl()
  return <input id={control.id} aria-label={label} aria-describedby={control['aria-describedby']}
    type="range" min={min} max={max} step={step} value={value} onChange={e => set(+e.target.value)}
    className="w-full mt-2 accent-[#0099CC]" />
}

function Card({ icon, title, children }: { icon?: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 mb-4">
      {title && (
        <div className="text-sm font-bold text-[#0D1B3E] flex items-center gap-2 mb-4">
          {icon && <span className="text-4.5">{icon}</span>}{title}
        </div>
      )}
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const id = useId()
  const labelId = `${id}-label`
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <FieldContext.Provider value={{ labelId, hintId }}><div className="mb-3.5">
      <div className="text-xs font-semibold text-[#556070] mb-1.5 flex justify-between">
        <span id={labelId}>{label}</span>
        {hint && <span id={hintId} className="text-[#0099CC] font-medium">{hint}</span>}
      </div>
      {children}
    </div></FieldContext.Provider>
  )
}

function KpiCard({ label, value, kind, sub, highlight }: {
  label: string; value: string; kind: string; sub: string; highlight?: boolean
}) {
  const valColor = highlight ? 'text-white'
    : kind === 'positive' ? 'text-[#15803d]'
    : kind === 'negative' ? 'text-[#C41230]'
    : 'text-[#0D1B3E]'
  return (
    <div className={`rounded-xl py-3.5 px-4 ${highlight ? 'border-none' : 'border border-[#E2E8F0]'}`}
      style={{ background: highlight ? 'linear-gradient(135deg, #0D1B3E 0%, #1a3a6e 100%)' : '#F8F9FC' }}>
      <div className={`text-[10.5px] font-bold tracking-[.08em] uppercase mb-1.5 ${highlight ? 'text-white/70' : 'text-[#556070]'}`}>{label}</div>
      <div className={`font-sans text-6.5 font-bold leading-none ${valColor}`}>{value}</div>
      <div className={`text-2.75 mt-1.5 ${highlight ? 'text-white/60' : 'text-[#556070]'}`}>{sub}</div>
    </div>
  )
}

export default function Calculator() {
  const go = useNav()
  const { t, i18n } = useTranslation('calculator')
  const [scenario, setScenario] = useState<Scenario>('rent')
  const [price, setPrice] = useState(500_000)
  const [downPct, setDownPct] = useState(25)
  const [closingPct, setClosingPct] = useState(4)
  const [reno, setReno] = useState(25_000)
  const [rate, setRate] = useState(6.5)
  const [term, setTerm] = useState(25)
  const [financing, setFinancing] = useState<Financing>('mortgage')
  const [rent, setRent] = useState(3_500)
  const [occupancy, setOccupancy] = useState(75)
  const [rentGrowth, setRentGrowth] = useState(3)
  const [propTaxPct, setPropTaxPct] = useState(1)
  const [mgmtPct, setMgmtPct] = useState(10)
  const [maintPct, setMaintPct] = useState(1.5)
  const [insPct, setInsPct] = useState(0.5)
  const [confoturYrs, setConfoturYrs] = useState<number>(0)
  const [appRate, setAppRate] = useState(5)
  const [flipHoldingMonths, setFlipHoldingMonths] = useState(8)
  const [flipResalePct, setFlipResalePct] = useState(32)
  const [flipSellingPct, setFlipSellingPct] = useState(3)
  const [sharedReady, setSharedReady] = useState(false)
  const [invalidShared, setInvalidShared] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportStatus, setExportStatus] = useState('')
  const [manualLink, setManualLink] = useState('')
  const exportLock = useRef(false)
  const alive = useRef(true)
  const latest = useRef<RoiState | null>(null)

  const setScenarioMode = (s: Scenario) => {
    setScenario(s)
    if (s === 'vacation') { setRent(5_500); setOccupancy(60) }
    else if (s === 'flip') { setRent(0); setReno(75_000) }
    else { setRent(3_500); setOccupancy(75); setReno(25_000) }
  }

  const locale: RoiLocale = i18n.language.startsWith('es') ? 'es' : 'en'
  const assumptions = useMemo<RoiState>(() => ({
    v: 1, currency: 'USD', locale, scenario, financing, price, downPct, closingPct, reno, rate, term,
    rent, occupancy, rentGrowth, propTaxPct, mgmtPct, maintPct, insPct, confoturYrs, appRate,
    flipHoldingMonths, flipResalePct, flipSellingPct,
  }), [locale, scenario, financing, price, downPct, closingPct, reno, rate, term, rent, occupancy, rentGrowth, propTaxPct, mgmtPct, maintPct, insPct, confoturYrs, appRate, flipHoldingMonths, flipResalePct, flipSellingPct])
  latest.current = assumptions
  useEffect(() => { setManualLink(''); setExportStatus(previous => previous === 'export.restored' ? previous : '') }, [assumptions])
  const model = useMemo(() => isRoiState(assumptions) && !invalidShared ? calculateRoi(assumptions) : null, [assumptions, invalidShared])
  const calc = useMemo(() => {
    if (!model) return { flip: scenario === 'flip', kpis: [], years: [], maxBar: 1, scenarios: null, breakeven: Infinity }
    const item = (label: string, value: string, number: number | null, sub: string, highlight = false) => ({
      label: t(label), value, kind: number === null ? 'neutral' : number < 0 ? 'negative' : 'positive', sub: t(sub), highlight,
    })
    const kpis = model.flip ? [
      item('kpis.flip_profit_label', fmt(model.flipProfit), model.flipProfit, 'kpis.flip_profit_sub'),
      item('kpis.roc_label', pct(model.flipReturnOnInitialCash), model.flipReturnOnInitialCash, 'kpis.roc_sub', true),
      item('kpis.hold_label', flipHoldingMonths + ' ' + t('report.months'), flipHoldingMonths, 'kpis.hold_sub'),
      item('kpis.resale_label', fmt(model.resale), model.resale, 'kpis.resale_sub'),
      item('kpis.invest_label', fmt(model.initialCash), model.initialCash, 'kpis.invest_sub'),
      item('kpis.sell_cost_label', fmt(model.sellingCost), model.sellingCost, 'kpis.sell_cost_sub'),
      item('report.holding_expense', fmt(model.holdingInterest + model.holdingTax), model.holdingInterest + model.holdingTax, 'report.holding_cost_sub'),
      item('kpis.mort_label', fmt(model.monthlyMortgage), model.monthlyMortgage, 'kpis.mort_sub'),
    ] : [
      item('kpis.roi_label', pct(model.cashOnCash), model.cashOnCash, 'kpis.roi_sub', true),
      item('kpis.cf_label', (model.monthlyCashFlow >= 0 ? '+' : '') + fmt(model.monthlyCashFlow), model.monthlyCashFlow, 'kpis.cf_sub'),
      item('kpis.be_label', model.breakeven === null ? '—' : model.breakeven.toFixed(1) + ' ' + t('report.years'), model.breakeven, 'kpis.be_sub'),
      item('kpis.yield_label', pct(model.grossYield), model.grossYield, 'kpis.yield_sub'),
      item('kpis.invest_label', fmt(model.initialCash), model.initialCash, 'kpis.invest_sub'),
      item('kpis.cap_label', pct(model.capRate), model.capRate, 'kpis.cap_sub'),
      item('kpis.return10_label', fmt(model.tenYearCashAndValue), model.tenYearCashAndValue, 'kpis.return10_sub'),
      item('kpis.mort_label', fmt(model.monthlyMortgage), model.monthlyMortgage, 'kpis.mort_sub'),
    ]
    return { flip: model.flip, kpis, years: model.years, maxBar: model.maxBar,
      breakeven: model.breakeven ?? Infinity,
      scenarios: model.scenarios?.map(row => ({ ...row, label: t(row.labelKey), be: row.be ?? Infinity })) ?? null }
  }, [model, scenario, flipHoldingMonths, t])
  const paybackScale = roiSimplePaybackScale(model?.breakeven ?? null)
  const paybackText = paybackScale.kind === 'undefined' ? t('breakeven.undefined')
    : t(paybackScale.kind === 'beyond' ? 'breakeven.beyond' : 'breakeven.within', { years: paybackScale.years.toLocaleString(locale === 'es' ? 'es-DO' : 'en-US', { maximumFractionDigits: 1 }) })

  useEffect(() => {
    alive.current = true
    let revision = 0
    const restore = () => {
      const turn = ++revision
      const parsed = readRoiFragment(window.location.hash)
      setInvalidShared(parsed.invalid); setSharedReady(false)
      if (!parsed.state) { setSharedReady(true); return }
      const value = parsed.state
      setScenario(value.scenario); setPrice(value.price); setDownPct(value.downPct); setClosingPct(value.closingPct)
      setReno(value.reno); setRate(value.rate); setTerm(value.term); setFinancing(value.financing)
      setRent(value.rent); setOccupancy(value.occupancy); setRentGrowth(value.rentGrowth); setPropTaxPct(value.propTaxPct)
      setMgmtPct(value.mgmtPct); setMaintPct(value.maintPct); setInsPct(value.insPct); setConfoturYrs(value.confoturYrs); setAppRate(value.appRate)
      setFlipHoldingMonths(value.flipHoldingMonths); setFlipResalePct(value.flipResalePct); setFlipSellingPct(value.flipSellingPct)
      void i18n.changeLanguage(value.locale).then(() => {
        if (alive.current && turn === revision) { setSharedReady(true); setExportStatus('export.restored') }
      }).catch(() => { if (alive.current && turn === revision) { setInvalidShared(true); setSharedReady(true) } })
    }
    restore(); window.addEventListener('hashchange', restore)
    return () => { alive.current = false; revision++; window.removeEventListener('hashchange', restore) }
  }, [i18n])

  const whatsapp = useMemo(() => model ? roiWhatsAppUrl(assumptions, i18n.getFixedT(locale, 'calculator')) : '', [model, assumptions, i18n, locale])
  const exportPdf = async () => {
    if (!model || !sharedReady || exportLock.current) return
    exportLock.current = true; setExportBusy(true); setExportStatus(''); setManualLink('')
    const snapshot = { ...assumptions }, translate = i18n.getFixedT(locale, 'calculator')
    try {
      const { downloadRoiPdf } = await import('../lib/roiPdf')
      await downloadRoiPdf(snapshot, translate)
      if (alive.current) setExportStatus('export.pdf_ready')
    } catch { if (alive.current) setExportStatus('export.pdf_error') }
    finally { exportLock.current = false; if (alive.current) setExportBusy(false) }
  }
  const copyLink = async () => {
    if (!model || !sharedReady || exportLock.current) return
    exportLock.current = true
    const snapshot = { ...assumptions }
    try {
      const clipboard = navigator.clipboard
      const result = await copyRoiLink(snapshot, typeof clipboard?.writeText === 'function' ? value => clipboard.writeText(value) : undefined)
      if (alive.current && JSON.stringify(latest.current) === JSON.stringify(snapshot)) { setManualLink(result.copied ? '' : result.url); setExportStatus(result.copied ? 'export.copied' : 'export.manual_copy') }
    } catch { if (alive.current) setExportStatus('export.link_error') }
    finally { exportLock.current = false }
  }

  const heroIcons = ['📊', '📈', '⚖️', '🏖️']
  const heroBadges = t('hero.badges', { returnObjects: true }) as string[]

  return (
    <div className="bg-[#F8F9FC] font-sans text-[#0D1B3E] min-h-[calc(100vh-74px)]">

      {/* HERO */}
      <div className="pt-12 sm:pt-15 px-4 sm:px-7 pb-10 sm:pb-13 relative overflow-hidden"
        style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1600&q=80&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(13,27,62,.95) 0%, rgba(26,58,110,.9) 50%, rgba(0,153,204,.78) 100%)' }} />
        <div className="absolute -top-15 -right-15 w-100 h-100 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(245,166,35,.18) 0%, transparent 70%)' }} />
        <div className="relative max-w-310 mx-auto">
          <div className="text-2.75 font-bold tracking-[.18em] uppercase text-[#F5A623] mb-3">
            {t('hero.eyebrow')}
          </div>
          <h1 className="font-sans text-[clamp(28px,4vw,52px)] font-extrabold text-white leading-[1.05] tracking-[-.02em] mb-3.5 max-w-175">
            {t('hero.h1_pre')} <em className="not-italic text-[#F5A623]">{t('hero.h1_em')}</em>
          </h1>
          <p className="text-4 text-white/70 leading-[1.6] max-w-155">
            {t('hero.sub')}
          </p>
          <div className="flex gap-2.5 flex-wrap mt-5.5">
            {heroIcons.map((ic, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white/10 border border-white/15 text-white py-1.5 px-3 rounded-full">{ic} {heroBadges[i]}</span>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-335 mx-auto pt-8 px-4 sm:px-7 pb-15 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: INPUTS ── */}
        <div>
          {/* Scenario */}
          <Card icon="🎯" title={t('scenario.title')}>
            <div className="grid grid-cols-3 gap-2">
              {([['rent', t('scenario.rent')], ['flip', t('scenario.flip')], ['vacation', t('scenario.vacation')]] as [Scenario, string][]).map(([k, l]) => (
                <button key={k} onClick={() => setScenarioMode(k)}
                  className={`py-2.75 rounded-md cursor-pointer font-sans text-3.25 font-semibold transition-all duration-150 border ${scenario === k ? 'bg-[#0D1B3E] text-white border-[#0D1B3E]' : 'bg-white text-[#556070] border-[#E2E8F0]'}`}>
                  {l}
                </button>
              ))}
            </div>
          </Card>

          {/* Property Details */}
          <Card icon="🏠" title={t('property.title')}>
            <Field label={t('property.purchase_price')} hint={t('property.usd')}>
              <NumberInput value={price} set={setPrice} min={50_000} max={5_000_000} step={10_000} prefix="$" />
              <RangeInput label={t('property.price_slider')} min={50_000} max={5_000_000} step={10_000} value={price} set={setPrice} />
              <div className="flex justify-between text-[10.5px] text-[#556070] mt-0.5"><span>{t('property.price_min')}</span><span>{t('property.price_max')}</span></div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('property.down_payment')} hint={financing === 'cash' ? t('property.cash_full') : undefined}><NumberInput value={downPct} set={setDownPct} min={0} max={100} suffix="%" disabled={financing === 'cash'} /></Field>
              <Field label={t('property.closing_costs')}><NumberInput value={closingPct} set={setClosingPct} min={0} max={15} suffix="%" /></Field>
            </div>
            <Field label={scenario === 'flip' ? t('property.reno_flip') : t('property.reno_rent')} hint={t('property.optional')}>
              <NumberInput value={reno} set={setReno} min={0} max={5_000_000} step={1_000} prefix="$" />
            </Field>
          </Card>

          {/* Financing */}
          <Card icon="🏦" title={t('financing.title')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('financing.interest_rate')}><NumberInput value={rate} set={setRate} min={0} max={20} step={0.1} suffix="%" /></Field>
              <Field label={t('financing.loan_term')}><NumberInput value={term} set={setTerm} min={5} max={30} suffix={t('report.years')} /></Field>
            </div>
            <Field label={t('financing.type_label')}>
              <SelectInput value={financing} set={v => setFinancing(v as Financing)} options={[
                ['mortgage', t('financing.mortgage')],
                ['cash',     t('financing.cash')],
                ['hard',     t('financing.hard')],
                ['seller',   t('financing.seller')],
              ]} />
            </Field>
            {financing === 'hard' ? <p className="text-xs leading-relaxed text-[#556070]">{t('financing.hard_note', { rate: (rate + 4).toFixed(2) })}</p> : null}
          </Card>

          {/* Income (hidden for flip) */}
          {scenario !== 'flip' && (
            <Card icon="💵" title={t('income.title')}>
              <Field label={t('income.monthly_rent')}>
                <NumberInput value={rent} set={setRent} min={0} max={30_000} step={100} prefix="$" />
                <RangeInput label={t('income.rent_slider')} min={300} max={30_000} step={100} value={rent} set={setRent} />
                <div className="flex justify-between text-[10.5px] text-[#556070] mt-0.5"><span>{t('income.rent_min')}</span><span>{t('income.rent_max')}</span></div>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('income.occupancy')}><NumberInput value={occupancy} set={setOccupancy} min={0} max={100} suffix="%" /></Field>
                <Field label={t('income.rent_growth')}><NumberInput value={rentGrowth} set={setRentGrowth} min={0} max={15} suffix="%" /></Field>
              </div>
            </Card>
          )}

          {scenario === 'flip' && <Card title={t('flip.title')}>
            <Field label={t('flip.holding_months')}><NumberInput value={flipHoldingMonths} set={setFlipHoldingMonths} min={1} max={120} suffix={t('report.months')} /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label={t('flip.resale_change')}><NumberInput value={flipResalePct} set={setFlipResalePct} min={-50} max={200} step={0.5} suffix="%" /></Field><Field label={t('flip.selling_cost')}><NumberInput value={flipSellingPct} set={setFlipSellingPct} min={0} max={20} step={0.1} suffix="%" /></Field></div>
            <p className="text-xs leading-relaxed text-[#556070]">{t('flip.note')}</p>
          </Card>}

          {/* Expenses */}
          <Card icon="📉" title={t('expenses.title')}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('expenses.prop_tax')}><NumberInput value={propTaxPct} set={setPropTaxPct} min={0} max={3} step={0.1} suffix="%" /></Field>
              <Field label={t('expenses.mgmt')}><NumberInput value={mgmtPct} set={setMgmtPct} min={0} max={30} suffix="%" /></Field>
              <Field label={t('expenses.maint')}><NumberInput value={maintPct} set={setMaintPct} min={0} max={30} step={0.1} suffix="%" /></Field>
              <Field label={t('expenses.insurance')}><NumberInput value={insPct} set={setInsPct} min={0} max={30} step={0.1} suffix="%" /></Field>
            </div>
            <Field label={t('expenses.confotur_label')} hint={t('expenses.confotur_hint')}>
              <NumberInput value={confoturYrs} set={setConfoturYrs} min={0} max={15} step={1} suffix={t('report.years')} />
            </Field>
            <p className="mb-3 text-xs leading-relaxed text-[#556070]">{t('expenses.tax_explainer')}</p>
            <div className="mb-4 flex flex-wrap gap-3 text-xs">{ROI_TAX_SOURCES.map(source => <a key={source.labelKey} href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#0077a3] underline">{t(source.labelKey)}</a>)}</div>
            <Field label={t('expenses.appreciation')}>
              <NumberInput value={appRate} set={setAppRate} min={0} max={20} step={0.5} suffix="%" />
            </Field>
          </Card>
        </div>

        {/* ── RIGHT: RESULTS ── */}
        <div>
          {invalidShared ? <div role="alert" className="mb-4 space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><p>{t('export.invalid_link')}</p><button type="button" className="rounded-lg border border-amber-500 bg-white px-3 py-2 font-semibold" onClick={() => { window.history.replaceState(null, '', window.location.pathname + window.location.search); setInvalidShared(false); setExportStatus('') }}>{t('export.use_shown_inputs')}</button></div> : !model ? <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{t('export.invalid_inputs')}</p> : null}
          {/* KPI grid */}
          <Card icon="📊" title={t('kpis.title')}>
            <div className="grid grid-cols-2 gap-2.5">
              {calc.kpis.map((kpi, i) => (
                <KpiCard key={i} label={kpi.label} value={kpi.value} kind={kpi.kind} sub={kpi.sub} highlight={kpi.highlight} />
              ))}
            </div>
            {!calc.flip ? <p className="mt-3 text-xs leading-relaxed text-[#556070]">{t('report.ten_year_note')}</p> : null}
          </Card>

          {/* 5-year bar chart */}
          {!calc.flip && calc.years.length > 0 && (
            <Card>
              <div className="flex justify-between items-center mb-3.5">
                <div className="font-sans text-4.25 font-bold text-[#0D1B3E]">{t('chart.title')}</div>
                <div className="flex gap-3.5 text-[11.5px] text-[#556070]">
                  {[['#10b981', t('chart.income')], ['#ef4444', t('chart.expenses')], ['#0099CC', t('chart.net')]].map(([col, l], i) => (
                    <span key={i} className="inline-flex items-center gap-1.25">
                      <span className="w-2.25 h-2.25 rounded-full inline-block" style={{ background: col }} />{l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-end justify-around h-45 gap-1 px-1.5">
                {calc.years.map((yr, i) => {
                  const incH = (yr.rent / calc.maxBar) * 140
                  const expH = (yr.exp  / calc.maxBar) * 140
                  const netBar = roiNetBar(yr.net, calc.maxBar)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center h-full">
                      <div className="flex items-end gap-0.75 flex-1">
                        <div title={fmt(yr.rent)} className="w-4.5 rounded-t"
                          style={{ height: incH, background: 'linear-gradient(180deg,#10b981,#059669)' }} />
                        <div title={fmt(yr.exp)} className="w-4.5 rounded-t"
                          style={{ height: expH, background: 'linear-gradient(180deg,#ef4444,#dc2626)' }} />
                        {netBar.kind === 'zero' ? <span title={t('chart.zero_net')} className="w-4.5 border-t-2 border-slate-500"><span className="sr-only">{t('chart.zero_net')}</span></span>
                          : <div title={fmt(yr.net)} className="w-4.5 rounded-t" style={{ height: netBar.heightPx, background: netBar.kind === 'gain' ? 'linear-gradient(180deg,#0099CC,#0077a3)' : 'linear-gradient(180deg,#f87171,#ef4444)' }} />}
                      </div>
                      <div className="text-[10.5px] text-[#556070] mt-1.5">{t('chart.year', { n: yr.y })}</div>
                    </div>
                  )
                })}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[#556070]">{t('chart.net_magnitude_note')}</p>
            </Card>
          )}

          {/* Simple payback is a constant year-one-flow ratio, not the growth projection. */}
          {model && !calc.flip && (
            <Card icon="⏱" title={t('breakeven.title')}>
              <div className="text-3.25 text-[#556070] mb-2.5">{t('breakeven.sub')}</div>
              <div role="img" aria-label={`${t('breakeven.scale')}: ${paybackText}`} className="pt-2">
                <div aria-hidden="true" className="relative h-3 rounded-full bg-[#E2E8F0]">
                  {paybackScale.kind === 'within' ? <span className="absolute -top-1 h-5 w-5 rounded-full border-3 border-[#0D1B3E] bg-white" style={{ left: `${paybackScale.positionPct}%`, transform: 'translateX(-50%)' }} />
                    : paybackScale.kind === 'beyond' ? <span className="absolute -right-1 -top-3 text-2xl font-bold text-[#0D1B3E]">→</span> : null}
                </div>
                <div aria-hidden="true" className="relative mt-2 h-5 text-[10px] text-[#556070]">{ROI_PAYBACK_TICKS.map(year => <span key={year} className="absolute" style={{ left: `${year / ROI_PAYBACK_SCALE_YEARS * 100}%`, transform: year === 0 ? undefined : year === ROI_PAYBACK_SCALE_YEARS ? 'translateX(-100%)' : 'translateX(-50%)' }}>{year}</span>)}</div>
              </div>
              <p className="text-xs text-[#556070]">{t('report.years')}</p>
              <p className="mt-3 text-sm font-semibold text-[#0D1B3E]">{paybackText}</p>
            </Card>
          )}

          {/* Scenario comparison table */}
          {!calc.flip && calc.scenarios && (
            <Card icon="⚖️" title={t('comparison.title')}>
              <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse font-sans min-w-105">
                <thead>
                  <tr>
                    {[t('comparison.col_scenario'), t('comparison.col_roi'), t('comparison.col_cf'), t('comparison.col_be')].map((h, i) => (
                      <th key={i} className={`text-2.75 font-bold tracking-[.06em] uppercase text-[#556070] py-2.5 px-2 border-b border-[#E2E8F0] ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calc.scenarios.map((s, i) => (
                    <tr key={i} className={s.current ? 'bg-[rgba(13,27,62,0.04)]' : ''}>
                      <td className={`text-3.25 text-[#0D1B3E] py-3 px-2 ${s.current ? 'font-bold' : 'font-semibold'}`}
                        style={{ borderBottom: i < calc.scenarios!.length - 1 ? '1px solid #E2E8F0' : 'none' }}>{s.label}</td>
                      <td className="text-right text-3.25 font-bold py-3 px-2"
                        style={{ color: s.roi === null ? '#556070' : s.roi >= 0 ? '#15803d' : '#C41230', borderBottom: i < calc.scenarios!.length - 1 ? '1px solid #E2E8F0' : 'none' }}>{pct(s.roi)}</td>
                      <td className="text-right text-3.25 font-semibold py-3 px-2"
                        style={{ color: s.cf >= 0 ? '#15803d' : '#C41230', borderBottom: i < calc.scenarios!.length - 1 ? '1px solid #E2E8F0' : 'none' }}>{(s.cf >= 0 ? '+' : '') + fmt(s.cf)}</td>
                      <td className="text-right text-3.25 text-[#556070] py-3 px-2"
                        style={{ borderBottom: i < calc.scenarios!.length - 1 ? '1px solid #E2E8F0' : 'none' }}>{isFinite(s.be) ? s.be.toFixed(1) + ' ' + t('report.years') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </Card>
          )}

          {/* Export / CTA */}
          <Card icon="📤" title={t('export.title')}>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={exportPdf} disabled={!model || !sharedReady || exportBusy} className="min-h-11 flex-1 basis-32.5 rounded-md border border-[#E2E8F0] bg-white px-3.5 py-2.75 text-sm font-semibold disabled:opacity-50">{t(exportBusy ? 'export.preparing' : 'export.pdf')}</button>
              <button type="button" onClick={copyLink} disabled={!model || !sharedReady || exportBusy} className="min-h-11 flex-1 basis-32.5 rounded-md border border-[#E2E8F0] bg-white px-3.5 py-2.75 text-sm font-semibold disabled:opacity-50">{t('export.link')}</button>
              {model && sharedReady ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex min-h-11 flex-1 basis-32.5 items-center justify-center rounded-md border border-[#25D366] bg-[#25D366] px-3.5 py-2.75 text-sm font-semibold text-white no-underline">{t('export.whatsapp')}</a> : <button type="button" disabled className="min-h-11 flex-1 basis-32.5 rounded-md bg-[#25D366] px-3.5 py-2.75 text-sm font-semibold text-white opacity-50">{t('export.whatsapp')}</button>}
            </div>
            {!sharedReady ? <p role="status" className="mt-3 text-sm text-[#556070]">{t('export.restoring')}</p> : null}
            {exportStatus ? <p role={exportStatus.endsWith('error') ? 'alert' : 'status'} aria-live="polite" className="mt-3 text-sm text-[#556070]">{t(exportStatus)}</p> : null}
            {manualLink ? <label className="mt-3 block text-xs font-semibold text-[#556070]">{t('export.link_field')}<input readOnly value={manualLink} onFocus={event => event.target.select()} className="mt-1 w-full rounded-lg border border-[#E2E8F0] bg-white p-3 text-sm text-[#0D1B3E]" /></label> : null}
            <p className="mt-3 text-xs leading-relaxed text-[#556070]">{t('export.share_note')}</p>
            <div className="text-2.75 text-[#556070] mt-3 leading-normal">
              <strong className="text-[#0D1B3E]">{t('export.note')}</strong> {t('export.disclaimer')}
            </div>
          </Card>

          {/* Talk to an agent */}
          <div className="rounded-2xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #0D1B3E 0%, #1a3a6e 100%)' }}>
            <div className="text-4.5 mb-2">🏡</div>
            <div className="font-sans text-4.5 font-bold text-white mb-2">{t('cta.heading')}</div>
            <p className="text-3.25 text-white/65 mb-4 leading-normal">{t('cta.sub')}</p>
            <div className="flex gap-2.5 justify-center flex-wrap">
              <button onClick={() => go('contact')}
                className="font-sans text-3.25 font-semibold cursor-pointer py-2.75 px-5.5 rounded-full border-none bg-[#0099CC] text-white">
                {t('cta.talk')}
              </button>
              <button onClick={() => go('search')}
                className="font-sans text-3.25 font-semibold cursor-pointer py-2.75 px-5.5 rounded-full bg-transparent text-white/80 border border-white/25">
                {t('cta.browse')}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
