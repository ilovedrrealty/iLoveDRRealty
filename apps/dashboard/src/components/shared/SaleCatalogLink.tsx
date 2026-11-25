import { useTranslation } from 'react-i18next'
import { canBrowseSales, SALE_CATALOG_PATH } from '../../lib/saleCatalog'

export function SaleCatalogLink({ accountRole }: { accountRole: string }) {
  const { t } = useTranslation('nav')
  if (!canBrowseSales(accountRole)) return null
  return <a href={SALE_CATALOG_PATH} className="inline-flex min-h-11 items-center rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-sea [overflow-wrap:anywhere]">{t('sale-properties')}</a>
}
