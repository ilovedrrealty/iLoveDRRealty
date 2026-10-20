import { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCurrentUser } from './hooks/useCurrentUser'
import { logout } from './api/auth'
import DashLayout from './layouts/DashLayout'
import Dashboard from './pages/Dashboard'
import AdminDash from './pages/AdminDash'
import { landingBaseUrl } from './lib/siteUrls'

const LANDING_URL = landingBaseUrl(import.meta.env.VITE_LANDING_URL)

export type Role = 'Buyer' | 'Owner' | 'Realtor' | 'Admin'

const ROLE_MAP: Record<string, Role> = {
  buyer: 'Buyer',
  owner: 'Owner',
  realtor: 'Realtor',
  admin: 'Admin',
}

function DashboardPage() {
  const { view = 'home' } = useParams<{ view?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: user, loading, error, updateUser } = useCurrentUser()

  useEffect(() => {
    if (!loading && (error || !user)) {
      const destination = view === 'professional-profile' ? '?join=professional' : view === 'professional-directory' ? '?directory=professionals' : ''
      window.location.href = `${LANDING_URL.replace(/\/$/, '')}/login${destination}`
    }
  }, [loading, user, error, view])

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-paper">
      <div className="w-8 h-8 border-4 border-sea border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!user) return null

  const accountRole: Role = ROLE_MAP[user.role] ?? 'Buyer'
  const workspaceParam = searchParams.get('workspace') ?? ''
  const requestedWorkspace = ['admin', 'buyer', 'owner', 'realtor'].includes(workspaceParam) ? ROLE_MAP[workspaceParam] : undefined
  // A workspace selects screens, never the user's identity or server permissions.
  const role: Role = accountRole === 'Admin' ? requestedWorkspace ?? 'Admin' : accountRole
  const go = (v: string, openId?: string, workspace?: Role) => {
    if (!window.dispatchEvent(new Event('ildr:before-dashboard-navigation', { cancelable: true }))) return
    const path = v === 'home' ? '/' : `/${v}`
    const params = new URLSearchParams()
    if (accountRole === 'Admin') params.set('workspace', (workspace ?? role).toLowerCase())
    if (openId) params.set('openId', openId)
    navigate(`${path}${params.size ? `?${params}` : ''}`)
  }
  const changeWorkspace = (next: Role) => {
    if (accountRole !== 'Admin' || !['Admin', 'Buyer', 'Owner', 'Realtor'].includes(next)) return
    if (!window.dispatchEvent(new Event('ildr:before-dashboard-navigation', { cancelable: true }))) return
    navigate(`/?workspace=${next.toLowerCase()}`)
  }

  const handleLogout = async () => {
    if (!window.dispatchEvent(new Event('ildr:before-dashboard-navigation', { cancelable: true }))) return
    await logout()
    window.location.href = `${LANDING_URL}/login`
  }

  return (
    <DashLayout role={role} view={view} go={go} onLogout={handleLogout} user={user} onWorkspaceChange={accountRole === 'Admin' ? changeWorkspace : undefined}>
      {role === 'Admin'
        ? <AdminDash go={go} view={view} user={user} onUserUpdate={updateUser} />
        : <Dashboard key={role} go={go} view={view} role={role} user={user} onUserUpdate={updateUser} onWorkspaceChange={accountRole === 'Admin' ? changeWorkspace : undefined} />
      }
    </DashLayout>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/"       element={<DashboardPage />} />
      <Route path="/:view"  element={<DashboardPage />} />
      <Route path="*"       element={<Navigate to="/" replace />} />
    </Routes>
  )
}
