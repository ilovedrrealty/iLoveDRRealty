'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { manualComposeLinks, validateManualContent, type ManualContent, type ShareFormat, type ShareLocale } from './manual'
import { manualCopy } from './manualCopy'
import { downloadShareFile } from './shareImage'

const BUTTON = 'inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-40'
const FIELD = 'mt-1 block min-h-11 min-w-0 w-full rounded-xl border border-line bg-white p-3 text-sm text-ink'

/** A preview and user-triggered handoff only; no remote posting/sending/uploading. */
export function ManualShareActions({ locale, content, load }: { locale: ShareLocale; content?: ManualContent; load?: (signal: AbortSignal) => Promise<ManualContent | null> }) {
  const copy = manualCopy(locale), id = useId(), key = JSON.stringify(content ?? null)
  const [approved, setApproved] = useState<ManualContent | null>(null), [busy, setBusy] = useState<'read' | 'image' | 'share' | null>(null)
  const [feedback, setFeedback] = useState(''), [format, setFormat] = useState<ShareFormat>('post'), [photo, setPhoto] = useState<string | null>(null)
  const [asset, setAsset] = useState<{ blob: Blob; url: string } | null>(null), [nativeAvailable, setNativeAvailable] = useState(false), [fileAvailable, setFileAvailable] = useState(false)
  const active = useRef<AbortController | null>(null), alive = useRef(true), epoch = useRef(0), locked = useRef(false), opened = useRef(false)
  const value = approved, note = value ? copy[value.audience] : '', links = value ? manualComposeLinks(value, note) : null
  useEffect(() => {
    alive.current = true; setNativeAvailable(typeof navigator.share === 'function')
    return () => { alive.current = false; epoch.current++; active.current?.abort() }
  }, [])
  useEffect(() => {
    epoch.current++; active.current?.abort(); active.current = null; locked.current = false
    setBusy(null); setFeedback(''); setPhoto(null); setAsset(null)
    setApproved(load ? null : content ? validateManualContent(content) : null)
    // Content identity contains only the approved entry link and public/generic labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, locale])
  useEffect(() => { setAsset(null) }, [photo, format])
  useEffect(() => () => { if (asset) URL.revokeObjectURL(asset.url) }, [asset])
  useEffect(() => {
    setFileAvailable(false)
    if (!asset || typeof File === 'undefined' || typeof navigator.canShare !== 'function') return
    try { setFileAvailable(navigator.canShare({ files: [new File([asset.blob], 'ilovedrrealty-' + format + '-' + locale + '.png', { type: 'image/png' })] })) } catch { /* Downloads remain available. */ }
  }, [asset, format, locale])

  async function toggle(open: boolean) {
    opened.current = open
    if (!open) { epoch.current++; active.current?.abort(); active.current = null; locked.current = false; setBusy(null); if (load) setApproved(null); return }
    if (!load || locked.current) return
    const controller = new AbortController(), token = ++epoch.current
    active.current = controller; locked.current = true; setBusy('read'); setFeedback(''); setApproved(null)
    const timeout = window.setTimeout(() => controller.abort(), 15000)
    try {
      const next = await load(controller.signal)
      if (alive.current && opened.current && token === epoch.current && !controller.signal.aborted) {
        setApproved(next ? validateManualContent(next) : null); setPhoto(null); setAsset(null)
        if (!next) setFeedback(copy.unavailable)
      }
    } catch { if (alive.current && opened.current && token === epoch.current) { setApproved(null); setFeedback(copy.unavailable) } }
    finally { window.clearTimeout(timeout); if (alive.current && token === epoch.current) { active.current = null; locked.current = false; setBusy(null) } }
  }
  async function copyText(text: string) {
    if (locked.current) return
    const token = epoch.current
    try { await navigator.clipboard.writeText(text); if (alive.current && token === epoch.current) setFeedback(copy.copied) }
    catch { if (alive.current && token === epoch.current) setFeedback(copy.failed) }
  }
  async function nativeShare(withImage = false) {
    if (!value || !links || locked.current || typeof navigator.share !== 'function') return
    const token = epoch.current
    const payload: ShareData = { title: value.title, text: links.preview }
    if (withImage) {
      if (!asset || !fileAvailable) return
      try {
        payload.files = [new File([asset.blob], 'ilovedrrealty-' + format + '-' + locale + '.png', { type: 'image/png' })]
        if (!navigator.canShare?.(payload)) { setFeedback(copy.failed); return }
      } catch { setFeedback(copy.failed); return }
    }
    locked.current = true; setBusy('share')
    try { await navigator.share(payload); if (alive.current && token === epoch.current) setFeedback(copy.nativeClosed) }
    catch (error) { if (alive.current && token === epoch.current) setFeedback((error as { name?: string })?.name === 'AbortError' ? copy.canceled : copy.failed) }
    finally { if (alive.current && token === epoch.current) { locked.current = false; setBusy(null) } }
  }
  async function prepareImage() {
    if (!value || !links || locked.current) return
    const controller = new AbortController(), token = ++epoch.current
    active.current = controller; locked.current = true; setBusy('image'); setFeedback(''); setAsset(null)
    const timeout = window.setTimeout(() => controller.abort(), 20000)
    try {
      if (load) {
        const latest = await load(controller.signal), safe = latest ? validateManualContent(latest) : null
        if (!alive.current || !opened.current || token !== epoch.current || controller.signal.aborted) return
        if (!safe) { setApproved(null); throw new Error('Unavailable listing') }
        if (JSON.stringify(safe) !== JSON.stringify(value)) { setApproved(safe); setPhoto(null); setFeedback(copy.changed); return }
      }
      const { createShareImage } = await import('./shareImage')
      const blob = await createShareImage(value, format, locale, photo, controller.signal)
      if (alive.current && opened.current && token === epoch.current && !controller.signal.aborted) setAsset({ blob, url: URL.createObjectURL(blob) })
    } catch { if (alive.current && opened.current && token === epoch.current) setFeedback(copy.imageFailed) }
    finally { window.clearTimeout(timeout); if (alive.current && token === epoch.current) { active.current = null; locked.current = false; setBusy(null) } }
  }
  function download(kind: 'image' | 'caption') {
    if (!links || locked.current || kind === 'image' && !asset) return
    try {
      downloadShareFile(kind === 'image' ? asset!.blob : new Blob([links.preview + '\n'], { type: 'text/plain;charset=utf-8' }),
        kind === 'image' ? `ilovedrrealty-${format}-${locale}.png` : `ilovedrrealty-caption-${locale}.txt`)
    } catch { if (alive.current) setFeedback(copy.failed) }
  }
  return <details className="min-w-0 max-w-full rounded-xl border border-line bg-white p-3 text-ink" onToggle={event => void toggle(event.currentTarget.open)} onKeyDown={event => {
    if (event.key === 'Escape' && event.currentTarget.open) { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() }
  }}>
    <summary className="min-h-11 cursor-pointer content-center text-sm font-semibold focus-visible:outline-2 focus-visible:outline-coral">{copy.open}</summary>
    <div className="mt-3 min-w-0 space-y-4">
      <h2 className="text-base font-bold">{copy.heading}</h2>{busy === 'read' ? <p role="status">{copy.preparing}</p> : null}
      {value && links ? <>
        <p className="text-xs leading-relaxed text-ink2">{note}</p>
        <pre className="max-w-full whitespace-pre-wrap break-words rounded-lg bg-paper p-3 font-sans text-sm [overflow-wrap:anywhere]">{links.preview}</pre>
        <div className="flex flex-wrap gap-2">
          <button className={BUTTON} type="button" disabled={!!busy} onClick={() => void copyText(value.url)}>{copy.copyLink}</button>
          <button className={BUTTON} type="button" disabled={!!busy} onClick={() => void copyText(links.preview)}>{copy.copyCaption}</button>
          {(['whatsapp', 'facebook', 'sms', 'email', 'linkedin', 'x'] as const).map(channel => <a key={channel} href={links[channel]} className={BUTTON}
            target={channel === 'email' || channel === 'sms' ? undefined : '_blank'} rel="noopener noreferrer" aria-disabled={!!busy}
            onClick={event => { if (busy) event.preventDefault() }}>{copy[channel]}</a>)}
          {nativeAvailable ? <button type="button" className={BUTTON} disabled={!!busy} onClick={() => void nativeShare()}>{copy.native}</button> : null}
        </div>
        <p className="text-xs leading-relaxed text-ink2">{copy.manual}</p>
        <section className="min-w-0 space-y-3 border-t border-line pt-4" aria-labelledby={id + '-assets'}>
          <h3 id={id + '-assets'} className="text-sm font-bold">{copy.assets}</h3>
          <label className="block text-sm font-semibold">{copy.format}<select className={FIELD} value={format} disabled={!!busy} onChange={event => setFormat(event.target.value as ShareFormat)}><option value="post">{copy.post}</option><option value="story">{copy.story}</option></select></label>
          {value.photos?.length ? <label className="block text-sm font-semibold">{copy.choosePhoto}<select className={FIELD} value={photo ?? ''} disabled={!!busy} onChange={event => setPhoto(event.target.value || null)}><option value="">{copy.noPhoto}</option>{value.photos.map((url, index) => <option key={url} value={url}>{copy.photo} {index + 1}</option>)}</select></label> : null}
          <button type="button" className={BUTTON} disabled={!!busy} aria-busy={busy === 'image'} onClick={() => void prepareImage()}>{busy === 'image' ? copy.rendering : copy.prepareImage}</button>
          {asset ? <div className="space-y-3"><img src={asset.url} alt={copy.imageAlt} className="max-h-[36rem] max-w-full rounded-lg border border-line object-contain" /><div className="flex flex-wrap gap-2"><button className={BUTTON} type="button" disabled={!!busy} onClick={() => void download('image')}>{copy.download}</button><button className={BUTTON} type="button" disabled={!!busy} onClick={() => void download('caption')}>{copy.captionFile}</button>{fileAvailable ? <button className={BUTTON} type="button" disabled={!!busy} onClick={() => void nativeShare(true)}>{copy.shareImage}</button> : null}</div></div> : null}
          <p className="text-xs leading-relaxed text-ink2">{copy.handoff}</p><a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className={BUTTON}>{copy.instagram}</a>
        </section>
      </> : null}
      {feedback ? <p role="status" className="text-sm text-ink2">{feedback}</p> : null}
      {load && !value && !busy ? <button type="button" className={BUTTON} onClick={() => void toggle(true)}>{copy.retry}</button> : null}
    </div>
  </details>
}
