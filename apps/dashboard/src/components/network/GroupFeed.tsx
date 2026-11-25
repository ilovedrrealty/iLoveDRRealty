import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  GROUP_PHOTO_LIMIT, createGroupComment, createGroupPost, getGroupComments, getGroupPosts,
  hideGroupComment, moderateGroupPost, uploadGroupPhoto,
  type Group, type GroupComment, type GroupMedia, type GroupPost,
} from '../../api/socialGroups'
import { useGroupMutation } from '../../hooks/useGroupMutation'
import { useNetworkRead } from '../../hooks/useNetworkRead'
import { GroupActionStatus, GroupPhoto, GroupPhotos } from './GroupShared'
import { ProfileAuthor } from './ProfileAuthor'
import {
  NETWORK_BUTTON, NETWORK_FIELD, NETWORK_PRIMARY, NetworkDate, NetworkFreshness, NetworkPagination,
  NetworkPanel, allowNetworkNavigation, networkError, useNetworkDraftGuard,
} from './NetworkShared'

type FeedProps = { actorId: string; group: Group; fresh: boolean; onGroupChanged: () => void }

export function GroupFeed(props: FeedProps) {
  // A changed audience/role is a new private draft context. Ordinary background
  // checks keep this key, preserving text while freshness temporarily disables writes.
  const { group, actorId } = props
  const context = `${actorId}:${group.id}:${group.visibility}:${group.status}:${group.my_role ?? 'reader'}:${group.can_post}:${group.can_read_feed}`
  return <Feed key={context} {...props} context={context} />
}

function Feed({ actorId, group, fresh, onGroupChanged, context }: FeedProps & { context: string }) {
  const { t } = useTranslation('property_network')
  const [page, setPage] = useState(1)
  const read = useNetworkRead(`group-feed:${context}:${page}`, signal => getGroupPosts(group.id, page, signal), group.can_read_feed)
  const current = read.data
  const ready = fresh && !read.stale && !read.checking && !!current && !read.error
  const refresh = () => { read.refresh(); onGroupChanged() }
  return <NetworkPanel title={t('groups.feed_title')}>
    <NetworkFreshness read={read} />
    <p className="text-xs leading-relaxed text-dim">{t('groups.feed_help')}</p>
    {!!read.error && <p role="alert" className="mt-3 text-sm text-red-800">{t(networkError(read.error))}</p>}
    {!current && !read.error && group.can_read_feed && <p role="status" className="mt-3">{t('loading')}</p>}
    {group.can_post && current ? <PostComposer key={context} group={group} context={context} ready={ready} revalidate={refresh}
      onSaved={() => setPage(1)} /> : <p className="mt-3 text-sm text-dim">{t('groups.feed_readonly')}</p>}
    <div className="mt-5 space-y-5">{current?.items.map(post => <PostCard key={post.id} actorId={actorId}
      group={group} post={post} context={context} fresh={ready} onChanged={refresh} />)}</div>
    {current && !current.items.length && <p className="mt-4 text-sm text-dim">{t('groups.feed_empty')}</p>}
    {current && <NetworkPagination page={page} total={current.total} busy={read.checking} onChange={setPage} />}
  </NetworkPanel>
}

function PostComposer({ group, context, ready, onSaved, revalidate }: { group: Group; context: string; ready: boolean; onSaved: () => void; revalidate: () => void }) {
  const { t } = useTranslation('property_network')
  const [body, setBody] = useState(''), [attachments, setAttachments] = useState<GroupMedia[]>([])
  const [localError, setLocalError] = useState(''), [saved, setSaved] = useState(false)
  const postAction = useGroupMutation(`group-post-create:${context}`, revalidate)
  const uploadAction = useGroupMutation(`group-post-upload:${context}`, revalidate)
  const blocked = !ready || postAction.blocked || uploadAction.blocked
  useNetworkDraftGuard(!!body || attachments.length > 0 || postAction.pending || uploadAction.pending,
    postAction.busy || uploadAction.busy)

  function upload(file?: File) {
    if (!file || blocked || attachments.length >= 6) return
    setSaved(false); setLocalError('')
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > GROUP_PHOTO_LIMIT) {
      setLocalError('photo_invalid'); return
    }
    uploadAction.run(id => uploadGroupPhoto(group.id, 'post', id, file), receipt => {
      const media = receipt.current
      if (receipt.operation !== 'media_upload' || !media || !('sha256' in media)
        || media.kind !== 'post' || media.group_id !== group.id || receipt.target_id !== media.id) {
        setLocalError('error_access'); return
      }
      setAttachments(previous => previous.some(item => item.id === media.id) || previous.length >= 6 ? previous : [...previous, media])
    }, false)
  }
  function publish() {
    if (blocked || !body.trim() && !attachments.length) return
    setLocalError(''); setSaved(false)
    const input = { body: body.trim(), media_ids: attachments.map(photo => photo.id), expected_group_version: group.version }
    postAction.run(submission_id => createGroupPost(group.id, { submission_id, ...input }), () => {
      setBody(''); setAttachments([]); setSaved(true); onSaved()
    })
  }
  return <form className="mt-4 min-w-0 space-y-3 rounded-xl border border-line bg-white p-4" onSubmit={event => { event.preventDefault(); publish() }}>
    <p className="text-xs font-semibold text-sea">{t(`groups.post_audiences.${group.visibility}`)}</p>
    {group.post_policy === 'moderated' && group.my_role === 'member' && <p className="text-xs text-dim">{t('groups.post_moderated')}</p>}
    <label className="block min-w-0 text-sm font-semibold">{t('groups.write_post')}
      <textarea className={`${NETWORK_FIELD} min-w-0 max-w-full`} rows={3} maxLength={4000} value={body}
        required={!attachments.length} disabled={blocked} onChange={event => { setBody(event.target.value); setSaved(false) }} />
    </label>
    <label className="block min-w-0 text-sm font-semibold">{t('attach_photos')}
      <input type="file" className="mt-2 block max-w-full text-sm" accept="image/jpeg,image/png,image/webp"
        disabled={blocked || attachments.length >= 6} onChange={event => { upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
    </label>
    <p className="text-xs text-dim">{t('photo_help')}</p>
    <GroupPhotos ids={attachments.map(photo => photo.id)} context={`draft:${context}`} />
    {!!attachments.length && <div className="flex flex-wrap gap-2">{attachments.map((photo, index) => <button key={photo.id} type="button"
      className={NETWORK_BUTTON} disabled={blocked} onClick={() => setAttachments(previous => previous.filter(item => item.id !== photo.id))}>
      {t('remove_attachment', { number: index + 1 })}</button>)}</div>}
    {localError && <p role="alert" className="text-sm text-red-800">{t(localError)}</p>}
    {saved && <p role="status" className="text-sm text-sea">{t('groups.post_saved')}</p>}
    <GroupActionStatus action={uploadAction} />
    <GroupActionStatus action={{ ...postAction, retryAllowed: postAction.retryAllowed && ready && !uploadAction.blocked,
      retry: () => { if (ready && !uploadAction.blocked) postAction.retry() } }} />
    <button className={NETWORK_PRIMARY} type="submit" disabled={blocked || !body.trim() && !attachments.length}>{t('groups.publish_post')}</button>
  </form>
}

function PostCard({ actorId, group, post, context, fresh, onChanged }: {
  actorId: string; group: Group; post: GroupPost; context: string; fresh: boolean; onChanged: () => void
}) {
  const { t } = useTranslation('property_network')
  const [reason, setReason] = useState('')
  const action = useGroupMutation(`group-post-moderation:${context}:${post.id}`, onChanged)
  useNetworkDraftGuard(!!reason || action.pending, action.busy)
  function moderate(kind: 'approve' | 'hide') {
    if (!fresh || action.blocked || kind === 'approve' && (!post.can_approve || group.status !== 'active') || kind === 'hide' && !post.can_hide) return
    if (kind === 'hide' && !window.confirm(t('groups.confirm_hide_post'))) return
    const input = { expected_version: post.version, action: kind, reason: reason.trim() }
    action.run(submission_id => moderateGroupPost(post.id, { submission_id, ...input }), () => setReason(''))
  }
  return <article className="min-w-0 space-y-3 rounded-xl border border-line bg-white p-4">
    <div className="flex flex-wrap justify-between gap-2"><p className="min-w-0 max-w-full text-sm font-bold text-ink [overflow-wrap:anywhere]"><ProfileAuthor author={post.author} /></p>
      <p className="text-xs text-dim"><NetworkDate value={post.created_at} showTime /></p></div>
    <p className="text-xs font-semibold text-sea">{t(`post_statuses.${post.status}`)} · {t(`groups.post_audiences.${post.created_audience}`)}</p>
    <p className="whitespace-pre-wrap break-words text-sm text-ink2">{post.body}</p>
    <GroupPhotos ids={post.media_ids} context={`${context}:${post.id}:${post.version}`} />
    {(post.can_approve || post.can_hide && post.status !== 'hidden') && <div className="min-w-0 space-y-3">
      <label className="block min-w-0 text-sm font-semibold">{t('groups.moderation_reason')}
        <textarea className={`${NETWORK_FIELD} min-w-0 max-w-full`} rows={2} maxLength={500} disabled={!fresh || action.blocked}
          value={reason} onChange={event => setReason(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2">
        {post.can_approve && <button type="button" className={NETWORK_PRIMARY} disabled={!fresh || action.blocked || group.status !== 'active'} onClick={() => moderate('approve')}>{t('approve_post')}</button>}
        {post.can_hide && post.status !== 'hidden' && <button type="button" className={NETWORK_BUTTON} disabled={!fresh || action.blocked} onClick={() => moderate('hide')}>{t('hide_post')}</button>}
      </div>
    </div>}
    <GroupActionStatus action={{ ...action, retryAllowed: action.retryAllowed && fresh, retry: () => { if (fresh) action.retry() } }} />
    <PostComments actorId={actorId} group={group} post={post} context={context} fresh={fresh} onChanged={onChanged} />
  </article>
}

function PostComments({ actorId, group, post, context, fresh, onChanged }: {
  actorId: string; group: Group; post: GroupPost; context: string; fresh: boolean; onChanged: () => void
}) {
  const { t } = useTranslation('property_network')
  const [open, setOpen] = useState(false), [page, setPage] = useState(1), [photo, setPhoto] = useState<string | null>(null)
  const read = useNetworkRead(`group-comments:${actorId}:${context}:${post.id}:${post.version}:${page}`,
    signal => getGroupComments(post.id, page, signal), open && group.can_read_feed)
  const data = read.data, ready = fresh && !read.stale && !read.checking && !!data && !read.error
  const selectedPhoto = photo !== null && post.media_ids.includes(photo) ? photo : null
  const refresh = () => { read.refresh(); onChanged() }
  return <section className="min-w-0 border-t border-line pt-3">
    <button type="button" className={NETWORK_BUTTON} aria-expanded={open} onClick={() => {
      if (!open || allowNetworkNavigation()) setOpen(value => !value)
    }}>{t(open ? 'hide_comments' : 'comments')}</button>
    {open && <div className="mt-3 min-w-0 space-y-3">
      <NetworkFreshness read={read} />
      {!!read.error && <p role="alert" className="text-sm text-red-800">{t(networkError(read.error))}</p>}
      {!data && !read.error && <p role="status">{t('loading')}</p>}
      {data?.items.map(comment => <CommentCard key={comment.id} comment={comment} context={`${context}:${post.id}`}
        mediaIds={post.media_ids} fresh={ready} onChanged={refresh} />)}
      {data && !data.items.length && <p className="text-sm text-dim">{t('no_comments')}</p>}
      {data && <NetworkPagination page={page} total={data.total} busy={read.checking} onChange={setPage} />}
      {post.can_comment && group.can_post && group.comments_enabled && data ? <>
        <label className="block min-w-0 text-sm font-semibold">{t('comment_context')}
          <select className={`${NETWORK_FIELD} min-w-0 max-w-full`} value={selectedPhoto ?? ''} disabled={!ready} onChange={event => {
            const next = event.target.value
            if (next && !post.media_ids.includes(next)) return
            if (allowNetworkNavigation()) setPhoto(next || null)
          }}><option value="">{t('comment_whole_entry')}</option>
            {post.media_ids.map((id, index) => <option key={id} value={id}>{t('comment_photo', { number: index + 1 })}</option>)}
          </select>
        </label>
        {selectedPhoto && <GroupPhoto id={selectedPhoto} context={`${context}:${post.id}:${post.version}`} />}
        <CommentComposer key={`${context}:${post.id}:${selectedPhoto ?? 'whole'}`} post={post} context={context}
          photo={photo} ready={ready} revalidate={refresh} onSaved={() => setPage(1)} />
      </> : <p className="text-xs text-dim">{t('comments_readonly')}</p>}
    </div>}
  </section>
}

function CommentComposer({ post, context, photo, ready, onSaved, revalidate }: {
  post: GroupPost; context: string; photo: string | null; ready: boolean; onSaved: () => void; revalidate: () => void
}) {
  const { t } = useTranslation('property_network')
  const [body, setBody] = useState(''), [error, setError] = useState('')
  const action = useGroupMutation(`group-comment-create:${context}:${post.id}:${photo ?? 'whole'}`, revalidate)
  useNetworkDraftGuard(!!body || action.pending, action.busy)
  function save() {
    if (!ready || action.blocked || !body.trim()) return
    if (photo !== null && !post.media_ids.includes(photo)) { setError('error_fields'); return }
    setError('')
    const input = { body: body.trim(), media_id: photo }
    action.run(submission_id => createGroupComment(post.id, { submission_id, ...input }), () => { setBody(''); onSaved() })
  }
  return <form className="min-w-0 space-y-3 rounded-xl border border-line bg-paper p-3" onSubmit={event => { event.preventDefault(); save() }}>
    <label className="block min-w-0 text-sm font-semibold">{t('write_update')}
      <textarea className={`${NETWORK_FIELD} min-w-0 max-w-full`} rows={3} maxLength={2000} required value={body}
        disabled={!ready || action.blocked} onChange={event => setBody(event.target.value)} />
    </label>
    {error && <p role="alert" className="text-sm text-red-800">{t(error)}</p>}
    <GroupActionStatus action={{ ...action, retryAllowed: action.retryAllowed && ready, retry: () => { if (ready) action.retry() } }} />
    <button type="submit" className={NETWORK_PRIMARY} disabled={!ready || action.blocked || !body.trim()}>{t('save_entry')}</button>
  </form>
}

function CommentCard({ comment, context, mediaIds, fresh, onChanged }: {
  comment: GroupComment; context: string; mediaIds: string[]; fresh: boolean; onChanged: () => void
}) {
  const { t } = useTranslation('property_network')
  const [reason, setReason] = useState('')
  const action = useGroupMutation(`group-comment-hide:${context}:${comment.id}`, onChanged)
  useNetworkDraftGuard(!!reason || action.pending, action.busy)
  function hide() {
    if (!fresh || action.blocked || !comment.can_hide || comment.hidden || !window.confirm(t('groups.confirm_hide_comment'))) return
    const input = { expected_version: comment.version, action: 'hide' as const, reason: reason.trim() }
    action.run(submission_id => hideGroupComment(comment.id, { submission_id, ...input }), () => setReason(''))
  }
  return <article className="min-w-0 space-y-2 rounded-lg bg-line-soft p-3">
    <div className="flex flex-wrap justify-between gap-2"><p className="min-w-0 max-w-full text-xs font-bold [overflow-wrap:anywhere]"><ProfileAuthor author={comment.author} /></p>
      <p className="text-xs text-dim"><NetworkDate value={comment.created_at} showTime /></p></div>
    <p className="text-xs font-semibold text-sea">{comment.media_id === null ? t('comment_whole_entry') : mediaIds.includes(comment.media_id)
      ? t('comment_photo', { number: mediaIds.indexOf(comment.media_id) + 1 }) : t('comment_photo_unavailable')}</p>
    <p className="whitespace-pre-wrap break-words text-sm text-ink2">{comment.body}</p>
    {comment.hidden && <p className="text-xs text-amber-950">{t('hidden')}</p>}
    {comment.can_hide && !comment.hidden && <div className="min-w-0 space-y-2">
      <label className="block min-w-0 text-sm font-semibold">{t('groups.moderation_reason')}
        <textarea className={`${NETWORK_FIELD} min-w-0 max-w-full`} rows={2} maxLength={500} disabled={!fresh || action.blocked}
          value={reason} onChange={event => setReason(event.target.value)} /></label>
      <button type="button" className={NETWORK_BUTTON} disabled={!fresh || action.blocked} onClick={hide}>{t('hide_comment')}</button>
    </div>}
    <GroupActionStatus action={{ ...action, retryAllowed: action.retryAllowed && fresh, retry: () => { if (fresh) action.retry() } }} />
  </article>
}
