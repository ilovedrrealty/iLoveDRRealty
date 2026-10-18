import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { uploadListingImages } from '../../api/listings'
import { isPublicHttps } from '../../data/websiteEditorDefaults'
import type { LocalizedText } from '../../../../../packages/website-settings/src'

export const editorInput = 'w-full min-w-0 rounded-lg border border-line bg-white px-3 py-2.5 text-sm text-ink focus:outline-2 focus:outline-offset-1 focus:outline-coral disabled:opacity-60'
export const editorButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

export function EditorCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5 space-y-4"><h3 className="m-0 text-base font-bold text-ink">{title}</h3>{children}</section>
}

export function TextField({ label, value, onChange, multiline = false, maxLength, placeholder }: {
  label: string; value: string; onChange: (value: string) => void; multiline?: boolean; maxLength?: number; placeholder?: string
}) {
  return <label className="block min-w-0 text-sm font-medium text-ink2">
    <span className="block mb-1.5">{label}</span>
    {multiline ? <textarea rows={3} className={editorInput} value={value} maxLength={maxLength} placeholder={placeholder} onChange={event => onChange(event.target.value)} />
      : <input className={editorInput} value={value} maxLength={maxLength} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}
  </label>
}

export function LocalizedFields({ label, value, onChange, multiline = false, maxLength }: {
  label: string; value: LocalizedText; onChange: (value: LocalizedText) => void; multiline?: boolean; maxLength?: number
}) {
  const { t } = useTranslation('website_editor')
  return <div className="grid min-w-0 sm:grid-cols-2 gap-3">{(['en', 'es'] as const).map(language => <TextField key={language}
    label={t('fields.with_language', { label, language: t(`languages.${language}`) })} value={value[language]}
    onChange={text => onChange({ ...value, [language]: text })} multiline={multiline} maxLength={maxLength} />)}</div>
}

export function VisibilityField({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  const { t } = useTranslation('website_editor')
  return <label className="flex items-center gap-2 min-h-10 text-sm text-ink2 cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-coral" checked={value} onChange={event => onChange(event.target.checked)} />{t('fields.visible')}</label>
}

export function OrderControls({ name, index, total, onMove, onRemove, canRemove = true }: {
  name: string; index: number; total: number; onMove: (direction: -1 | 1) => void; onRemove: () => void; canRemove?: boolean
}) {
  const { t } = useTranslation('website_editor')
  return <div className="flex flex-wrap gap-2">
    <button type="button" className={editorButton} disabled={index === 0} aria-label={t('actions.up_named', { name })} onClick={() => onMove(-1)}><ArrowUp size={15} aria-hidden="true" />{t('actions.up')}</button>
    <button type="button" className={editorButton} disabled={index === total - 1} aria-label={t('actions.down_named', { name })} onClick={() => onMove(1)}><ArrowDown size={15} aria-hidden="true" />{t('actions.down')}</button>
    <button type="button" className={editorButton} disabled={!canRemove} aria-label={t('actions.remove_named', { name })} onClick={onRemove}><Trash2 size={15} aria-hidden="true" />{t('actions.remove')}</button>
  </div>
}

export function PhotoField({ label, value, onChange, onBusy, allowBlank = false }: {
  label: string; value: string; onChange: (value: string) => void; onBusy: (busy: boolean) => void; allowBlank?: boolean
}) {
  const { t } = useTranslation('website_editor')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  return <div className="space-y-2 min-w-0">
    {isPublicHttps(value) && <img src={value} alt={label} loading="lazy" referrerPolicy="no-referrer" className="h-32 w-48 max-w-full rounded-lg object-cover border border-line" />}
    <TextField label={t('fields.photo_url', { label })} value={value} onChange={onChange} />
    {allowBlank && <p className="text-xs text-dim">{t('photos.blank_default')}</p>}
    <label className="block text-sm text-ink2"><span className="block mb-1">{t('photos.upload_named', { label })}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} className="block max-w-full text-xs"
        onChange={async event => {
          const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''
          if (!file) return
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { setError(t('photos.file_error')); return }
          setUploading(true); setError(''); onBusy(true)
          try {
            const urls = await uploadListingImages([file])
            if (!urls[0] || !isPublicHttps(urls[0])) throw new Error('Missing public image URL')
            onChange(urls[0])
          } catch { setError(t('photos.upload_error')) }
          finally { setUploading(false); onBusy(false) }
        }} />
    </label>
    {uploading && <p role="status" className="text-xs text-dim">{t('photos.uploading')}</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>
}

export function moved<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items]; const target = index + direction
  if (target < 0 || target >= items.length) return next
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}
