const DEFAULT_LANDING_URL = 'https://ilovedrrealty.com'

/** Empty build settings must not turn a tools screen into an Invalid URL error. */
export function landingBaseUrl(configured: string | undefined): string {
  try {
    const url = new URL(configured?.trim() || DEFAULT_LANDING_URL)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return DEFAULT_LANDING_URL
    return url.origin
  } catch { return DEFAULT_LANDING_URL }
}

/** Account completion pages belong on the public site, including app.* dashboards. */
export function deactivationRedirectUrl(configured: string | undefined): string {
  return new URL('/?msg=deactivated', landingBaseUrl(configured)).toString()
}
