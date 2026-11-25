/** Navigation only. The destination independently authenticates its own hotel user. */
export function managementNavigation(accountRole: string, workspace: string, accountId?: string): string | null {
  const adminNavigation = accountRole === 'admin' && workspace === 'Admin'
  const arlynNavigation = accountRole === 'realtor' && accountId === '30e0a4b8-aab7-4af8-9b0b-ccbde1dd4e64'
  return adminNavigation || arlynNavigation ? 'https://management.kaobahotel.com/' : null
}
