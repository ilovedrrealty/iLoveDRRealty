import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { ExternalLink, History, Save } from 'lucide-react'
import { getWebsiteHistory, getWebsiteLocationOptions, getWebsiteSettings, publishWebsiteSettings, restoreWebsiteRevision } from '../../api/websiteSettings'
import { cloneSettings, hydrateEditorSettings, prepareWebsiteSettings, validateWebsiteSettings, websiteChangeCount } from '../../data/websiteEditorDefaults'
import { encodeWebsiteDraft, parseWebsiteDraft } from '../../data/websiteDraftCache'
import { WebsiteEditorCopy, type ChangeWebsiteDraft } from './WebsiteEditorCopy'
import { WebsiteAreasPanel, WebsiteGalleryPanel, WebsiteMenuPanel, WebsiteResourcesPanel, WebsiteTeamPanel } from './WebsiteEditorPanels'
import { EditorCard, editorButton } from './WebsiteEditorFields'
import type { WebsiteRevision, WebsiteSettings, WebsiteSettingsResponse } from '../../../../../packages/website-settings/src'

const TABS = ['copy', 'photos', 'menu', 'areas', 'resources', 'team', 'history'] as const
type EditorTab = typeof TABS[number]

export function WebsiteEditor({ userId }: { userId?: string } = {}) {
  const { t, i18n } = useTranslation('website_editor')
  const [tab, setTab] = useState<EditorTab>('copy')
  const [draft, setDraft] = useState<WebsiteSettings>(() => hydrateEditorSettings({}))
  const [baseline, setBaseline] = useState<WebsiteSettings>(() => hydrateEditorSettings({}))
  const [version, setVersion] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploads, setUploads] = useState(0)
  const [errorKey, setErrorKey] = useState('')
  const [successKey, setSuccessKey] = useState('')
  const [conflict, setConflict] = useState(false)
  const [history, setHistory] = useState<WebsiteRevision[]>([])
  const [historyError, setHistoryError] = useState(false)
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null)
  const [locationOptions, setLocationOptions] = useState<{ value: string; count: number }[]>([])
  const [cacheStatus, setCacheStatus] = useState<'none' | 'saved' | 'not_saved' | 'unavailable'>('none')
  const [recovered, setRecovered] = useState(false)
  const [retainedCache, setRetainedCache] = useState<string | null>(null)
  const [cacheWarning, setCacheWarning] = useState<'stale' | 'invalid' | null>(null)
  const storageKey = userId ? `ildr.website-editor-draft.v1:${encodeURIComponent(userId)}` : null
  const changes = useMemo(() => websiteChangeCount(baseline, draft), [baseline, draft])
  const issues = useMemo(() => validateWebsiteSettings(draft), [draft])
  const busy = saving || loading || uploads > 0

  const acceptResponse = useCallback((response: WebsiteSettingsResponse) => {
    const next = hydrateEditorSettings(response.settings)
    setDraft(next); setBaseline(cloneSettings(next)); setVersion(response.version)
    setUpdatedAt(response.updated_at ?? null); setLoaded(true); setConflict(false)
  }, [])
  const loadHistory = useCallback(async () => {
    try { setHistory(await getWebsiteHistory()); setHistoryError(false) }
    catch { setHistoryError(true) }
  }, [])
  const clearSavedDraft = useCallback(() => {
    try { if (storageKey) sessionStorage.removeItem(storageKey) } catch { /* The draft in memory is still usable. */ }
    setRetainedCache(null); setCacheWarning(null); setRecovered(false); setCacheStatus('none')
  }, [storageKey])
  const loadLatest = useCallback(async (recoverDraft = false) => {
    setLoading(true); setErrorKey(''); setSuccessKey('')
    if (!recoverDraft) clearSavedDraft()
    try {
      const response = await getWebsiteSettings()
      acceptResponse(response)
      if (recoverDraft && storageKey) {
        try {
          const raw = sessionStorage.getItem(storageKey)
          if (raw) {
            const cached = parseWebsiteDraft(raw)
            if (cached && cached.expectedVersion === response.version) { setDraft(cached.settings); setRecovered(true) }
            else { setRetainedCache(raw); setCacheWarning(cached ? 'stale' : 'invalid') }
          }
        } catch { setCacheStatus('unavailable') }
      }
    }
    catch { setErrorKey('errors.load') }
    finally { setLoading(false) }
  }, [acceptResponse, clearSavedDraft, storageKey])

  useEffect(() => {
    void loadLatest(true); void loadHistory()
    let cancelled = false
    getWebsiteLocationOptions().then(options => { if (!cancelled) setLocationOptions(options) }).catch(() => {})
    return () => { cancelled = true }
  }, [loadLatest, loadHistory])
  useEffect(() => {
    if (!loaded || loading || saving || !storageKey || retainedCache) return
    try {
      if (!changes) { sessionStorage.removeItem(storageKey); setCacheStatus('none'); return }
      const raw = encodeWebsiteDraft(version, prepareWebsiteSettings(draft))
      if (!raw) { setCacheStatus('not_saved'); return }
      sessionStorage.setItem(storageKey, raw); setCacheStatus('saved')
    } catch { setCacheStatus('unavailable') }
  }, [loaded, loading, saving, storageKey, retainedCache, changes, version, draft])
  useEffect(() => {
    if (!changes && !uploads) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const guardNavigation = (event: Event) => {
      if (!window.confirm(t(uploads ? 'guard.upload' : cacheStatus === 'saved' ? 'guard.cached' : 'guard.draft'))) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    window.addEventListener('ildr:before-dashboard-navigation', guardNavigation)
    return () => {
      window.removeEventListener('beforeunload', warn)
      window.removeEventListener('ildr:before-dashboard-navigation', guardNavigation)
    }
  }, [changes, uploads, cacheStatus, t])

  const change: ChangeWebsiteDraft = update => { setDraft(update); setSuccessKey('') }
  const onBusy = useCallback((value: boolean) => setUploads(count => Math.max(0, count + (value ? 1 : -1))), [])
  const handleFailure = (error: unknown, fallback: string) => {
    if (isAxiosError(error) && error.response?.status === 409) { setConflict(true); setErrorKey('errors.conflict') }
    else setErrorKey(fallback)
  }
  const publish = async () => {
    if (!loaded || busy || conflict || retainedCache || !changes || issues.length) return
    setSaving(true); setErrorKey(''); setSuccessKey('')
    try {
      acceptResponse(await publishWebsiteSettings(version, prepareWebsiteSettings(draft)))
      clearSavedDraft()
      setSuccessKey('status.published'); await loadHistory()
    } catch (error) { handleFailure(error, 'errors.publish') }
    finally { setSaving(false) }
  }
  const restore = async () => {
    if (restoreVersion === null || busy || conflict || changes || restoreVersion === version) return
    setSaving(true); setErrorKey(''); setSuccessKey('')
    try {
      acceptResponse(await restoreWebsiteRevision(restoreVersion, version))
      clearSavedDraft()
      setSuccessKey('status.restored'); setRestoreVersion(null); await loadHistory()
    } catch (error) { handleFailure(error, 'errors.restore') }
    finally { setSaving(false) }
  }
  const formatDate = (value: string) => new Date(value).toLocaleString(i18n.language.startsWith('es') ? 'es-DO' : 'en-US')

  return <div className="max-w-5xl mx-auto min-w-0 pb-16 font-sans">
    <header className="flex flex-wrap items-start justify-between gap-4 mb-5">
      <div><h1 className="text-2xl font-bold text-ink m-0">{t('title')}</h1><p className="text-sm text-dim max-w-2xl mt-2 leading-relaxed">{t('intro')}</p></div>
      <a href="https://ilovedrrealty.com/" target="_blank" rel="noopener noreferrer" className={editorButton}><ExternalLink size={15} aria-hidden="true" />{t('actions.open_website')}</a>
    </header>

    <div className="sticky top-0 z-10 rounded-xl border border-line bg-white p-3 mb-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-ink2"><span className="font-semibold">{t('status.version', { version })}</span>
        <span className="block text-xs mt-1">{changes ? t('status.unsaved', { count: changes }) : t('status.no_changes')}</span>
        {updatedAt && <span className="block text-xs text-dim mt-1">{t('status.updated', { date: formatDate(updatedAt) })}</span>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || (!changes && !conflict)} className={editorButton} onClick={() => void loadLatest()}>{t(conflict ? 'actions.discard_reload' : 'actions.discard')}</button>
        <button type="button" disabled={!loaded || busy || conflict || !!retainedCache || !changes || issues.length > 0} onClick={() => void publish()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-coral border-0 text-white px-4 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          <Save size={16} aria-hidden="true" />{t(saving ? 'actions.saving' : 'actions.publish')}
        </button>
      </div>
    </div>
    {errorKey && <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800 mb-4">{t(errorKey)}
      {!loaded && <button type="button" disabled={busy} className={`${editorButton} mt-2 block`} onClick={() => void loadLatest(true)}>{t('actions.retry')}</button>}
    </div>}
    {successKey && <p role="status" className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800 mb-4">{t(successKey)}</p>}
    {recovered && <p role="status" className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-900 mb-4">{t('cache.recovered')}</p>}
    {cacheStatus !== 'none' && <p role="status" className="text-xs text-dim mb-3">{t(`cache.${cacheStatus}`)}</p>}
    {retainedCache && cacheWarning && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900 space-y-2">
      <p>{t(`cache.${cacheWarning}`)}</p>
      <div className="flex flex-wrap gap-2"><button type="button" className={editorButton} onClick={() => {
        const objectUrl = URL.createObjectURL(new Blob([retainedCache], { type: 'application/json' }))
        const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = 'ilovedrrealty-unpublished-draft.json'; anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
      }}>{t('cache.download')}</button>
        <button type="button" className={editorButton} onClick={clearSavedDraft}>{t('cache.discard_old')}</button></div>
    </div>}
    {uploads > 0 && <p role="status" className="text-sm text-dim mb-3">{t('photos.uploading')}</p>}
    {changes > 0 && issues.length > 0 && <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 mb-4 text-sm text-amber-900">
      <p className="font-semibold">{t('validation.fix_before_publish')}</p>
      <ul className="mt-2 pl-5 list-disc space-y-1">{issues.slice(0, 12).map((issue, index) => <li key={`${issue.field}-${index}`}>{t(issue.key)}{issue.field ? ` — ${issue.field}` : ''}</li>)}</ul>
    </div>}

    {loading ? <p role="status" className="py-8 text-sm text-dim">{t('loading')}</p> : loaded && <>
      <nav aria-label={t('tabs.label')} className="flex gap-2 overflow-x-auto pb-3 mb-4">
        {TABS.map(value => <button key={value} type="button" aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}
          className={`shrink-0 min-h-11 px-3 py-2 rounded-lg text-sm font-semibold border cursor-pointer ${tab === value ? 'bg-ink text-white border-ink' : 'bg-white text-ink2 border-line'}`}>{t(`tabs.${value}`)}</button>)}
      </nav>
      <fieldset className="min-w-0 border-0 p-0 m-0" disabled={saving} aria-busy={saving}>
        {tab === 'copy' && <WebsiteEditorCopy draft={draft} change={change} />}
        {tab === 'photos' && <WebsiteGalleryPanel draft={draft} change={change} onBusy={onBusy} />}
        {tab === 'menu' && <WebsiteMenuPanel draft={draft} change={change} />}
        {tab === 'areas' && <WebsiteAreasPanel draft={draft} change={change} locationOptions={locationOptions} />}
        {tab === 'resources' && <WebsiteResourcesPanel draft={draft} change={change} />}
        {tab === 'team' && <WebsiteTeamPanel draft={draft} change={change} onBusy={onBusy} />}
        {tab === 'history' && <EditorCard title={t('history.heading')}>
          <p className="text-sm text-dim leading-relaxed">{t('history.help')}</p>
          {historyError && <p role="alert" className="text-sm text-red-700">{t('errors.history')}</p>}
          <button type="button" className={editorButton} disabled={busy} onClick={() => void loadHistory()}><History size={15} aria-hidden="true" />{t('history.refresh')}</button>
          <fieldset className="min-w-0 space-y-2"><legend className="text-sm font-semibold mb-2">{t('history.choose')}</legend>
            {history.map(item => <label key={item.version} className="flex items-start gap-3 rounded-lg border border-line p-3 text-sm text-ink2 cursor-pointer">
              <input type="radio" name="website-revision" className="mt-1 accent-coral" checked={restoreVersion === item.version} disabled={item.version === version || busy}
                onChange={() => setRestoreVersion(item.version)} />
              <span><span className="font-semibold">{t('status.version', { version: item.version })}{item.version === version && ` · ${t('history.current')}`}</span>
                <span className="block text-xs text-dim mt-1">{formatDate(item.created_at)} · {item.updated_by_name || t('history.original')}</span></span>
            </label>)}
          </fieldset>
          {changes > 0 && <p className="text-sm text-amber-800">{t('history.finish_draft')}</p>}
          <button type="button" className={editorButton} disabled={restoreVersion === null || busy || conflict || changes > 0 || restoreVersion === version}
            onClick={() => void restore()}>{restoreVersion === null ? t('history.select_first') : t('history.restore', { version: restoreVersion })}</button>
        </EditorCard>}
      </fieldset>
    </>}
  </div>
}
