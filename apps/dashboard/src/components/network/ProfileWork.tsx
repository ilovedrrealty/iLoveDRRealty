import { useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { getProfileProjects, getProfileHistory } from '../../api/propertyNetwork'
import type { ProfessionalOptions } from '../../../../../packages/professionals/src'
import { professionalLabel } from '../../../../../packages/professionals/src'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { NETWORK_BUTTON, NETWORK_PRIMARY, NetworkFreshness, NetworkPagination, NetworkPanel, PrivatePhotos, allowNetworkNavigation, networkError } from './NetworkShared'
import { HistoryWorkMetadata } from './HistorySharing'

function WorkspaceLink({ id }: { id: string }) {
  const { t } = useTranslation('property_network')
  function follow(event: MouseEvent<HTMLAnchorElement>) {
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0 && !allowNetworkNavigation()) event.preventDefault()
  }
  return <a className={NETWORK_BUTTON + ' mt-3 inline-flex items-center'} href={'/property-network?tab=projects&project=' + id} onClick={follow}>{t('open_project')}</a>
}

/** Each read is the server's viewer-accessible ∩ target-associated projection, never a public portfolio. */
export function ProfileWork({ code, own, categories, onAccessLost }: { code: number; own: boolean; categories: ProfessionalOptions['categories']; onAccessLost?: () => void }) {
  const { t, i18n } = useTranslation('property_network')
  const [view, setView] = useState<'projects' | 'history' | null>(null), [projectPage, setProjectPage] = useState(1), [historyPage, setHistoryPage] = useState(1)
  const denied = useRef(onAccessLost); denied.current = onAccessLost
  function rejectAccess(cause: unknown, signal: AbortSignal): never {
    if (!signal.aborted && networkError(cause) === 'error_access') denied.current?.()
    throw cause
  }
  const projects = useNetworkRead(`profile-projects:${code}:${projectPage}`, signal => getProfileProjects(code, { page: projectPage }, signal).catch(cause => rejectAccess(cause, signal)), view === 'projects')
  const history = useNetworkRead(`profile-history:${code}:${historyPage}`, signal => getProfileHistory(code, { page: historyPage }, signal).catch(cause => rejectAccess(cause, signal)), view === 'history')
  const read = view === 'projects' ? projects : history
  const error = view && read.error ? networkError(read.error) : ''
  return <NetworkPanel title={t('customization.work_title')}>
    <p className="mb-4 text-xs leading-relaxed text-dim">{t('customization.work_note')}</p>
    <nav aria-label={t('customization.work_views')} className="flex flex-wrap gap-2">
      {(['projects', 'history'] as const).map(value => <button key={value} type="button" className={view === value ? NETWORK_PRIMARY : NETWORK_BUTTON}
        aria-expanded={view === value} onClick={() => setView(current => current === value ? null : value)}>{t(`customization.${own ? 'my_' : ''}${value}`)}</button>)}
    </nav>
    {view ? <div className="mt-4 min-w-0">
      <NetworkFreshness read={read} />
      {error ? <p role="alert" className="text-sm text-red-800">{t(error)}</p> : null}
      {!read.data && !error ? <p role="status">{t('loading')}</p> : null}
      {view === 'projects' && projects.data ? <>
        <div className="grid min-w-0 gap-3 md:grid-cols-2">{projects.data.items.map(project => <article key={project.id} className="min-w-0 rounded-xl border border-line bg-white p-4">
          <h3 className="break-words text-lg font-bold text-ink [overflow-wrap:anywhere]">{project.title}</h3>
          <p className="mt-2 break-words text-xs text-dim [overflow-wrap:anywhere]">{project.property_title ?? project.listing_title}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink2 [overflow-wrap:anywhere]">{project.summary}</p>
          <p className="mt-3 text-xs text-dim">{t(`statuses.${project.status}`)}</p>
          <p className="mt-1 break-words text-xs text-dim [overflow-wrap:anywhere]">{project.service_category_ids.map(id => {
            const category = categories.find(option => option.id === id)
            return category ? professionalLabel(category.label, i18n.language) : id
          }).join(' · ')}</p>
          <p className="mt-2 text-sm font-semibold text-ink">{project.progress.percent === null ? t('no_milestones') : t('progress', {
            completed: project.progress.completed, total: project.progress.total, percent: project.progress.percent.toLocaleString(i18n.language),
          })}</p>
          <WorkspaceLink id={project.id} />
        </article>)}</div>
        {!projects.data.items.length ? <p className="text-sm text-dim">{t('customization.projects_empty')}</p> : null}
        <NetworkPagination page={projectPage} total={projects.data.total} busy={projects.checking} onChange={setProjectPage} />
      </> : null}
      {view === 'history' && history.data ? <>
        <ol className="space-y-3">{history.data.items.map(item => <li key={item.id} className="min-w-0 rounded-xl border border-line bg-white p-4">
          <h3 className="break-words font-semibold text-ink [overflow-wrap:anywhere]">{item.project_title}</h3>
          <p className="mt-1 break-words text-xs text-dim [overflow-wrap:anywhere]"><HistoryWorkMetadata date={item.occurred_on} ids={item.service_category_ids} categories={categories} /> · {t(`event_kinds.${item.kind}`)} · {t(`statuses.${item.project_status}`)}</p>
          <p className="mt-2 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{t('customization.update_by', { name: item.author.display_name || t('customization.unnamed') })}</p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm text-ink2 [overflow-wrap:anywhere]">{item.body}</p>
          {item.correction_of ? <p className="mt-2 text-xs text-dim">{t('correction_note')}</p> : null}
          <PrivatePhotos ids={item.media_ids} onAccessLost={onAccessLost} />
          <WorkspaceLink id={item.project_id} />
        </li>)}</ol>
        {!history.data.items.length ? <p className="text-sm text-dim">{t('customization.history_empty')}</p> : null}
        <NetworkPagination page={historyPage} total={history.data.total} busy={history.checking} onChange={setHistoryPage} />
      </> : null}
    </div> : null}
  </NetworkPanel>
}
