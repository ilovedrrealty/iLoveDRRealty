import { useTranslation } from 'react-i18next'
import type { UserInfo } from '../lib/auth'
import { AdminHome } from './admin/Home'
import { AdminUsers } from './admin/Users'
import { AdminListings } from './admin/Listings'
import { AdminLeads } from './admin/Leads'
import { AdminBookings } from './admin/Bookings'
import { Analytics } from './admin/Analytics'
import { AdminSettings } from './admin/Settings'
import { BulkImportListings } from './admin/BulkImportListings'
import { ResearchTools } from './shared/ResearchTools'
import { WebsiteEditor } from './admin/WebsiteEditor'

export default function AdminDash({ go, view = 'home', user, onUserUpdate }: { go: (v: string, openId?: string) => void; view?: string; user: UserInfo; onUserUpdate: (updates: Partial<UserInfo>) => void }) {
  const { t } = useTranslation('admin')

  const pageKey = ['home', 'users', 'listings', 'leads', 'bookings', 'analytics', 'settings', 'bulk-import', 'research', 'website-editor'].includes(view) ? view : 'home'
  const title = t(`pages.${pageKey}.title`)
  const sub   = t(`pages.${pageKey}.sub`)

  function renderView() {
    switch (view) {
      case 'users':    return <AdminUsers />
      case 'listings': return <AdminListings />
      case 'leads':    return <AdminLeads />
      case 'bookings': return <AdminBookings />
      case 'analytics': return <Analytics />
      case 'settings': return <AdminSettings user={user} onUserUpdate={onUserUpdate} />
      case 'bulk-import': return <BulkImportListings />
      case 'research': return <ResearchTools user={user} />
      case 'website-editor': return <WebsiteEditor userId={user.id} />
      default:         return <AdminHome go={go} />
    }
  }

  return (
    <div>
      <div className="mb-7">
        <div className="text-[11px] font-bold tracking-[.14em] uppercase text-coral mb-1.5">{t('eyebrow')}</div>
        <h1 className="font-sans text-[22px] sm:text-[28px] font-extrabold text-ink tracking-[-0.02em] mb-1">
          {title}
        </h1>
        <p className="text-sm text-ink2">{sub}</p>
      </div>
      {renderView()}
    </div>
  )
}
