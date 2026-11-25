'use client'
import { useTranslation } from 'react-i18next'
import { ManualShareActions } from './ManualShareActions'
import { manualTargetUrl, safeShareTitle, type ManualTarget } from './manual'
import { manualCopy } from './manualCopy'

/** Entry links only. No caller state, calculations, private tool labels or workspace records. */
export function ResourceShare({ target, title }: { target: Exclude<ManualTarget, { kind: 'listing' }>; title?: string }) {
  const { i18n } = useTranslation(), locale = i18n.language.startsWith('es') ? 'es' : 'en'
  const copy = manualCopy(locale), url = manualTargetUrl(target)
  if (!url) return null
  const fallback = target.kind === 'calculator' ? copy.calculator : target.kind === 'area' ? copy.area
    : target.kind === 'research' ? copy.researchTitle : target.kind === 'hub' ? copy.hub : copy.resource
  return <ManualShareActions locale={locale} content={{ title: target.kind === 'resource' ? safeShareTitle(title, fallback) : fallback,
    facts: [], url, audience: target.kind === 'research' ? 'research' : target.kind === 'hub' || target.kind === 'area' ? 'member' : 'public' }} />
}
