import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { managementNavigation } from '../../lib/managementNavigation'

export function ManagementNavigation({ accountRole, accountId, workspace, onNavigate, appearance = 'sidebar' }: {
  accountRole: string; accountId?: string; workspace: string; onNavigate?: () => void; appearance?: 'sidebar' | 'profile'
}) {
  const { t } = useTranslation('nav')
  const href = managementNavigation(accountRole, workspace, accountId)
  if (!href) return null
  const profile = appearance === 'profile'
  return <div className={profile ? 'mb-4 min-w-0 rounded-xl border border-line bg-white p-3' : 'mt-4 border-t border-white/15 pt-3'}>
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={event => {
      if (!window.dispatchEvent(new Event('ildr:before-dashboard-navigation', { cancelable: true }))) event.preventDefault()
      else onNavigate?.()
    }} className={`flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${profile ? 'text-sea hover:bg-paper' : 'text-white/85 hover:bg-white/10'}`}>
      <ExternalLink size={15} aria-hidden="true" className="shrink-0" /><span className="[overflow-wrap:anywhere]">{t('management_portal')}</span>
    </a>
    <p className={`px-3 text-[11px] leading-relaxed ${profile ? 'text-ink2' : 'text-white/60'}`}>{t('management_navigation_note')}</p>
  </div>
}
