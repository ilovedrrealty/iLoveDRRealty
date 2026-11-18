import { useId } from 'react'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RECOMMENDED_DR_TOOLS } from '../../../../../packages/website-settings/src/drResources'
import {
  PURCHASE_COST_BASES, PURCHASE_COST_CATEGORIES, PURCHASE_COST_CURRENCIES, PURCHASE_COST_LABEL_LIMIT,
  PURCHASE_COST_ROW_LIMIT, blankPurchaseCostRow, purchaseCostAmount, purchaseCostMoney, purchaseCostTotals,
  type PurchaseCost, type PurchaseCostRow,
} from '../../data/purchaseCosts'

const source = RECOMMENDED_DR_TOOLS.find(tool => tool.id === 'dr-dgii-transfer-tax')
const field = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-sea disabled:opacity-60'
const button = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-sea disabled:opacity-50'
const label = 'block min-w-0 text-sm font-semibold text-ink2'

export function PurchaseCostWorksheet({ rows, costs, disabled, onChange }: {
  rows: PurchaseCostRow[]; costs: PurchaseCost[] | null; disabled: boolean; onChange: (rows: PurchaseCostRow[]) => void
}) {
  const { t, i18n } = useTranslation('research_tools', { keyPrefix: 'purchase_costs' })
  const headingId = useId()
  const formatId = useId()
  const locale = i18n.language.startsWith('es') ? 'es' : 'en'
  const totals = costs && purchaseCostTotals(costs)

  function change(position: number, values: Partial<PurchaseCostRow>) {
    onChange(rows.map((row, index) => index === position ? { ...row, ...values } : row))
  }

  return <section aria-labelledby={headingId} className="mt-4 min-w-0 space-y-3 border-t border-line pt-4">
    <h3 id={headingId} className="text-base font-bold text-ink">{t('heading')}</h3>
    <p className="text-sm text-ink2">{t('intro')}</p>
    {source && <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-sea underline focus-visible:outline-2 focus-visible:outline-sea">
      {source.title[locale]} <ExternalLink aria-hidden="true" size={14} />
    </a>}
    <div className="research-no-print print:hidden space-y-3">
      <p id={formatId} className="text-xs text-dim">{t('amount_help')}</p>
      {rows.map((row, index) => <fieldset key={index} disabled={disabled}
        className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-3">
        <legend className="px-1 text-sm font-bold text-ink">{t('row', { number: index + 1 })}</legend>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className={label}>{t('category')}
            <select className={field} value={row.category} onChange={event => change(index, { category: event.target.value as PurchaseCostRow['category'] })}>
              {PURCHASE_COST_CATEGORIES.map(category => <option key={category} value={category}>{t(`categories.${category}`)}</option>)}
            </select>
          </label>
          <label className={label}>{t('currency')}
            <select className={field} value={row.currency} onChange={event => change(index, { currency: event.target.value as PurchaseCostRow['currency'] })}>
              {PURCHASE_COST_CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </label>
          <label className={label}>{t('basis_label')}
            <select className={field} value={row.basis} onChange={event => change(index, { basis: event.target.value as PurchaseCostRow['basis'] })}>
              {PURCHASE_COST_BASES.map(basis => <option key={basis} value={basis}>{t(`basis.${basis}`)}</option>)}
            </select>
          </label>
          <label className={label}>{t('amount')}
            <input type="text" inputMode="decimal" value={row.amount} maxLength={18} className={field}
              aria-describedby={formatId} aria-invalid={purchaseCostAmount(row.amount).state === 'invalid'}
              onChange={event => change(index, { amount: event.target.value })} />
          </label>
        </div>
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <label className={`${label} flex-1 basis-48`}>{t('label')}
            <input value={row.label} maxLength={PURCHASE_COST_LABEL_LIMIT} className={field}
              onChange={event => change(index, { label: event.target.value })} />
          </label>
          <button type="button" className={button} onClick={() => onChange(rows.filter((_, position) => position !== index))}>
            <Trash2 aria-hidden="true" size={14} /> {t('remove', { number: index + 1 })}
          </button>
        </div>
      </fieldset>)}
      <button type="button" className={button} disabled={disabled || rows.length >= PURCHASE_COST_ROW_LIMIT}
        onClick={() => onChange([...rows, blankPurchaseCostRow()])}><Plus aria-hidden="true" size={14} />{t('add')}</button>
    </div>
    {costs === null && <p role="alert" className="text-sm text-red-700">{t('invalid')}</p>}
    {totals && <dl className="grid min-w-0 gap-2 sm:grid-cols-2" aria-label={t('totals')} aria-live="polite">
      {PURCHASE_COST_CURRENCIES.map(currency => {
        const total = totals[currency]
        return <div key={currency} className="min-w-0 rounded-lg border border-line bg-white p-3">
          <dt className="text-sm text-ink2">{t('total', { currency })}</dt>
          <dd className="font-bold tabular-nums text-ink [overflow-wrap:anywhere]">
            {total === null ? t('empty') : purchaseCostMoney(total, currency, locale === 'es')}
          </dd>
        </div>
      })}
    </dl>}
    {costs && costs.length > 0 && <ul className="hidden space-y-2 print:block">
      {costs.map((cost, index) => <li className="break-inside-avoid border-b border-line pb-1 text-sm" key={index}>
        <p className="font-semibold">{t(`categories.${cost.category}`)} · {t(`basis.${cost.basis}`)} · {purchaseCostMoney(cost.amount_minor, cost.currency, locale === 'es')}</p>
        {cost.label && <p className="[overflow-wrap:anywhere]">{cost.label}</p>}
      </li>)}
    </ul>}
  </section>
}
