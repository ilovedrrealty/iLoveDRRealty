'use client'
import { useEffect, useState } from 'react'
import { linkComposeLinks, linkSharePayload } from './index'

export type ShareLinkLabels = { open: string; title: string; note: string; copy: string; email: string; whatsapp: string;
  native: string; copied: string; failed: string; nativeClosed: string; canceled: string; noDelivery: string }

/** User-triggered composers only. No recipient, sending service or access change. */
export function ShareLinkActions({ url, labels }: { url: string | null; labels: ShareLinkLabels }) {
  const [nativeAvailable, setNativeAvailable] = useState(false)
  const [feedback, setFeedback] = useState('')
  const links = url ? linkComposeLinks(url, labels.title) : null
  useEffect(() => { setNativeAvailable(typeof navigator.share === 'function') }, [])
  useEffect(() => { setFeedback('') }, [url, labels.title])
  if (!url || !links) return null
  async function copy() {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setFeedback(labels.copied) }
    catch { setFeedback(labels.failed) }
  }
  async function nativeShare() {
    const payload = url ? linkSharePayload(url, labels.title) : null
    if (!payload || typeof navigator.share !== 'function') return
    try { await navigator.share(payload); setFeedback(labels.nativeClosed) }
    catch (cause) { setFeedback(cause instanceof Error && cause.name === 'AbortError' ? labels.canceled : labels.failed) }
  }
  return <details className="min-w-0 rounded-xl border border-line bg-white p-3 text-ink">
    <summary tabIndex={0} className="min-h-11 cursor-pointer content-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-coral">{labels.open}</summary>
    <p className="mt-2 text-xs leading-relaxed text-ink2">{labels.note}</p>
    <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-paper p-3 font-sans text-sm [overflow-wrap:anywhere]">{links.preview}</pre>
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={() => void copy()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">{labels.copy}</button>
      <a href={links.email} className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold">{labels.email}</a>
      <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line px-3 text-sm font-semibold">{labels.whatsapp}</a>
      {nativeAvailable && <button type="button" onClick={() => void nativeShare()} className="min-h-11 rounded-xl border border-line px-3 text-sm font-semibold">{labels.native}</button>}
    </div>
    {feedback && <p role="status" className="mt-3 text-sm text-ink2">{feedback}</p>}
    <p className="mt-3 text-xs leading-relaxed text-dim">{labels.noDelivery}</p>
  </details>
}
