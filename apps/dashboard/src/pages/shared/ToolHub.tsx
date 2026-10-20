import { ArrowRight, ArrowUpRight, BookOpen, Calculator, CalendarDays, ClipboardList, Heart, Home, MapPin, MessageCircle, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { UserInfo } from '../../lib/auth'
import { canOpenToolWorkspace, workspaceToolCards, type ToolWorkspace } from '../../data/toolHubs'
import { AreaConverter, DueDiligenceChecklist } from './ResearchTools'
import { landingBaseUrl } from '../../lib/siteUrls'

const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)
const ICONS = { search: Search, heart: Heart, calculator: Calculator, users: Users, book: BookOpen, home: Home, calendar: CalendarDays, leads: ClipboardList, research: MapPin, message: MessageCircle }

export function ToolHub({ workspace, user, go, compact = false }: { workspace: ToolWorkspace; user: UserInfo; go: (view: string, workspace?: ToolWorkspace) => void; compact?: boolean }) {
  const { t } = useTranslation('tool_hubs')
  const cards = workspaceToolCards(workspace, user.role)
  if (!canOpenToolWorkspace(user.role, workspace)) return (
    <section className="rounded-2xl border border-line bg-paper p-5" role="status">
      <h2 className="text-lg font-bold text-ink">{t('restricted_title')}</h2>
      <p className="text-sm text-ink2 mt-2">{t('restricted_description')}</p>
      <button type="button" onClick={() => go('buyer-tools', 'Buyer')} className="text-sm font-semibold text-sea underline mt-3">{t('open_buyer')}</button>
    </section>
  )
  return (
    <div className="space-y-5 mb-6">
      <section className="rounded-2xl border border-line bg-paper p-5 sm:p-6" aria-label={t(`workspaces.${workspace}.title`)}>
        <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
          <div>
            <h2 className="text-xl font-bold text-ink m-0">{t(`workspaces.${workspace}.title`)}</h2>
            <p className="text-sm text-ink2 leading-relaxed mt-2 mb-0 max-w-3xl">{t(`workspaces.${workspace}.description`)}</p>
          </div>
          {compact ? <button type="button" onClick={() => go(`${workspace.toLowerCase()}-tools`, workspace)} className="inline-flex items-center gap-1 text-sm font-semibold text-sea underline">{t('all_tools')}<ArrowRight size={15} aria-hidden="true" /></button> : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(card => {
            const Icon = ICONS[card.icon]
            const content = <><span className="flex items-center gap-2 text-sm font-bold text-sea"><Icon size={19} className="shrink-0" aria-hidden="true" />{t(`cards.${card.id}.title`)}</span><span className="block text-xs leading-relaxed text-ink2 mt-2">{t(`cards.${card.id}.description`)}</span><span className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-sea">{t('open')}{card.path ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowRight size={13} aria-hidden="true" />}</span></>
            const className = 'block h-full rounded-xl border border-line bg-white p-4 text-left no-underline transition-colors hover:border-sea focus-visible:outline-2 focus-visible:outline-sea focus-visible:outline-offset-2'
            return card.path ? <a key={card.id} href={`${LANDING_URL}${card.path}`} target="_blank" rel="noopener noreferrer" className={className}>{content}</a>
              : <button key={card.id} type="button" onClick={() => go(card.view!, workspace)} className={`${className} cursor-pointer`}>{content}</button>
          })}
        </div>
      </section>
      {!compact ? <>
        <section className="rounded-xl bg-sea/5 border border-sea/15 p-4">
          <h2 className="text-sm font-bold text-ink mt-0">{t('start_title')}</h2>
          <p className="text-sm leading-relaxed text-ink2 mb-0 mt-2">{t(`workspaces.${workspace}.start`)}</p>
        </section>
        <div className="grid gap-5 xl:grid-cols-2 items-start"><AreaConverter /><DueDiligenceChecklist /></div>
      </> : null}
    </div>
  )
}
