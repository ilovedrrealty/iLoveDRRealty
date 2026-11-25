import { useEffect, useState } from 'react'
import { getNetworkMediaBlob, type NetworkAuthor } from '../../api/propertyNetwork'

/** A secondary author image has separate current permissions from its surrounding wall. */
function AuthorPhoto({ id }: { id: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = ''
    getNetworkMediaBlob(id, controller.signal).then(blob => {
      if (!controller.signal.aborted) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl) }
    }).catch(() => { if (!controller.signal.aborted) setUrl('') })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [id])
  return url ? <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full bg-ink object-contain" onError={() => setUrl('')} /> : null
}

export function ProfileAuthor({ author }: { author: Pick<NetworkAuthor, 'display_name'> & { avatar_media_id?: string | null } }) {
  return <span className="inline-flex min-w-0 items-center gap-2">
    {author.avatar_media_id ? <AuthorPhoto key={author.avatar_media_id} id={author.avatar_media_id} /> : null}
    <span className="min-w-0 break-words [overflow-wrap:anywhere]">{author.display_name}</span>
  </span>
}
