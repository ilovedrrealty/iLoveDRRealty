import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COPY_DEFAULTS, DEFAULT_NAVIGATION, WEBSITE_COPY_NAMESPACES, copyTokens, normalizeLocation } from '../../data/websiteEditorDefaults'
import { EditorCard, TextField, editorButton, editorInput } from './WebsiteEditorFields'
import type { WebsiteSettings } from '../../../../../packages/website-settings/src'

export type ChangeWebsiteDraft = (update: (previous: WebsiteSettings) => WebsiteSettings) => void

export function WebsiteEditorCopy({ draft, change }: { draft: WebsiteSettings; change: ChangeWebsiteDraft }) {
  const { t } = useTranslation('website_editor')
  const [namespace, setNamespace] = useState<string>('landing')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(20)
  const menuRoutes = new Set([...DEFAULT_NAVIGATION, ...draft.navigation].map(item => item.route))
  const keys = [...new Set([
    ...Object.keys(COPY_DEFAULTS[namespace].en), ...Object.keys(COPY_DEFAULTS[namespace].es),
    ...Object.keys(draft.translations.en?.[namespace] ?? {}), ...Object.keys(draft.translations.es?.[namespace] ?? {}),
  ])].filter(key => !(namespace === 'team' && /^(principals|realtors)\.bios\.\d+\.(role|bio)$/.test(key))
    && !(namespace === 'common' && key.startsWith('nav.') && menuRoutes.has(key.slice(4))))
  const matching = keys.filter(key => normalizeLocation(`${key} ${COPY_DEFAULTS[namespace].en[key] ?? ''} ${COPY_DEFAULTS[namespace].es[key] ?? ''} ${draft.translations.en?.[namespace]?.[key] ?? ''} ${draft.translations.es?.[namespace]?.[key] ?? ''}`).includes(normalizeLocation(query)))
  return <div className="space-y-4">
    <p className="text-sm text-dim leading-relaxed">{t('copy.help')}</p>
    {(namespace === 'team' || namespace === 'common') && <p className="rounded-lg border border-line bg-white p-3 text-sm text-ink2">{t(namespace === 'team' ? 'copy.structured_team' : 'copy.structured_menu')}</p>}
    <div className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm font-medium text-ink2"><span className="block mb-1.5">{t('copy.page')}</span>
        <select value={namespace} className={editorInput} onChange={event => { setNamespace(event.target.value); setLimit(20) }}>
          {WEBSITE_COPY_NAMESPACES.map(value => <option key={value} value={value}>{t(`namespaces.${value}`)}</option>)}
        </select>
      </label>
      <TextField label={t('copy.search')} value={query} onChange={value => { setQuery(value); setLimit(20) }} />
    </div>
    <p role="status" className="text-xs text-dim">{t('copy.matches', { count: matching.length })}</p>
    {matching.slice(0, limit).map(key => <EditorCard key={`${namespace}.${key}`} title={key.replace(/\./g, ' / ')}>
      <div className="grid sm:grid-cols-2 gap-3">{(['en', 'es'] as const).map(language => {
        const baseline = COPY_DEFAULTS[namespace][language][key] ?? ''
        const value = draft.translations[language]?.[namespace]?.[key] ?? baseline
        const tokens = copyTokens(baseline)
        const invalid = JSON.stringify(copyTokens(value)) !== JSON.stringify(tokens)
        return <div key={language} className="min-w-0 space-y-1.5">
          <TextField label={t(`languages.${language}`)} value={value} multiline maxLength={6000} onChange={text => change(previous => ({
            ...previous,
            translations: { ...previous.translations, [language]: { ...previous.translations[language], [namespace]: { ...previous.translations[language]?.[namespace], [key]: text } } },
          }))} />
          {tokens.length > 0 && <p className="text-xs text-dim break-words">{t('copy.keep_tokens', { tokens: tokens.join(' ') })}</p>}
          {invalid && <p role="alert" className="text-xs text-red-700">{t('validation.placeholders')}</p>}
        </div>
      })}</div>
      <button type="button" className={editorButton} onClick={() => change(previous => {
        const translations = { ...previous.translations }
        for (const language of ['en', 'es'] as const) {
          const entries = { ...translations[language]?.[namespace] }; delete entries[key]
          translations[language] = { ...translations[language], [namespace]: entries }
        }
        return { ...previous, translations }
      })}>{t('copy.reset')}</button>
    </EditorCard>)}
    {matching.length === 0 && <p className="text-sm text-dim">{t('copy.no_matches')}</p>}
    {matching.length > limit && <button type="button" className={editorButton} onClick={() => setLimit(previous => previous + 20)}>{t('copy.more')}</button>}
  </div>
}
