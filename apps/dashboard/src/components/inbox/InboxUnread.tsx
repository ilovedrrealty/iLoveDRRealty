import { getInboxUnread } from '../../api/inbox'
import { useInboxRead } from '../../hooks/useInboxRead'
import { useTranslation } from 'react-i18next'

/** Counts only the authenticated actor's primary conversations, never oversight. */
export function InboxUnread({ actor }: { actor: string }) {
  const { t } = useTranslation('inbox')
  const read = useInboxRead('inbox-nav-unread:' + actor, getInboxUnread)
  return read.data && !read.stale && !read.error && read.data.entries > 0
    ? <><span aria-hidden="true" className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">{read.data.entries > 99 ? '99+' : read.data.entries}</span><span className="sr-only">{t('unread_count', { count: read.data.entries })}</span></> : null
}
