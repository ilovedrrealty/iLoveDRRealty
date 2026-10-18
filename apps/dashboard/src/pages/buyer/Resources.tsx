import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardLink } from '../../components/dashboard/shared'
import { BUYER_RESOURCES } from '../../components/dashboard/BuyerHome'

export function Resources() {
  const { t } = useTranslation('buyer')
  const { t: tProfessional } = useTranslation('professionals')
  return (
    <Card title={<><BookOpen size={14} />{t('resources_page.title')}</>}>
      <a href={`${(import.meta.env.VITE_LANDING_URL ?? 'https://ilovedrrealty.com').replace(/\/$/, '')}/professionals/`} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-line p-4 mb-3 text-sm font-semibold text-coral">{tProfessional('directory')} ↗</a>
      {BUYER_RESOURCES.map(({ Icon, title, time }, i) => (
        <div key={i} className={`flex items-center gap-3.5 py-3.5 ${i < BUYER_RESOURCES.length - 1 ? 'border-b border-line' : ''}`}>
          <div className="text-ink2 shrink-0"><Icon size={20} /></div>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold text-ink">{title}</div>
            <div className="text-[11.5px] text-dim">{time}</div>
          </div>
          <CardLink>{t('resources_page.read')}</CardLink>
        </div>
      ))}
    </Card>
  )
}
