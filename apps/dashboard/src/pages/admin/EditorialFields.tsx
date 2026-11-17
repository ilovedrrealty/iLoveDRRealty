import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  EDITORIAL_LANGUAGES, EDITORIAL_REVIEW_NOTE_LIMIT, EDITORIAL_SOURCE_LABEL_LIMIT, EDITORIAL_SOURCE_LIMIT,
  EDITORIAL_SOURCE_URL_LIMIT, EDITORIAL_TEXT_LIMITS,
  isTranslationComplete, type EditorialDraft, type EditorialKind, type EditorialLanguage, type EditorialPreview,
  type EditorialSource, type EditorialText,
} from '../../api/editorial'
import { isPublicHttps } from '../../data/websiteEditorDefaults'
import { editorButton, editorInput, TextField } from './WebsiteEditorFields'
import { NeighborhoodEditorialFields, NeighborhoodEditorialPreview } from './NeighborhoodEditorialFields'

export const editorialPrimary = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-sea px-4 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:opacity-50 disabled:cursor-not-allowed'
const panel = 'min-w-0 space-y-3 rounded-xl border border-line bg-white p-4'
const legend = 'px-1 text-base font-bold text-ink'
const emptySource = { label: '', url: '' }

export function EditorialFields({ draft, change, kind }: { draft: EditorialDraft; change: (draft: EditorialDraft) => void; kind: EditorialKind }) {
  const { t } = useTranslation('editorial')
  const rows = draft.sources.length ? draft.sources : [emptySource]
  function changeTranslation(language: EditorialLanguage, field: keyof EditorialText, value: string) {
    change({ ...draft, content: { ...draft.content, [language]: { ...draft.content[language], [field]: value } } })
  }
  function changeSource(index: number, field: keyof EditorialSource, value: string) {
    change({ ...draft, sources: rows.map((row, position) => position === index ? { ...row, [field]: value } : row) })
  }
  return <>
    <div className="grid min-w-0 gap-3 xl:grid-cols-2">
      {EDITORIAL_LANGUAGES.map(language => {
        const text = draft.content[language]
        return <fieldset key={language} className={panel}>
          <legend className={legend}>{t(`languages.${language}`)}</legend>
          <p className="text-xs font-medium text-ink2">
            {t(isTranslationComplete(text) ? 'completion.complete' : 'completion.incomplete')}
          </p>
          <TextField label={t('fields.title')} value={text.title} maxLength={EDITORIAL_TEXT_LIMITS.title}
            onChange={value => changeTranslation(language, 'title', value)} />
          <TextField label={t('fields.summary')} value={text.summary} maxLength={EDITORIAL_TEXT_LIMITS.summary}
            onChange={value => changeTranslation(language, 'summary', value)} multiline />
          <label className="block min-w-0 text-sm font-medium text-ink2">
            <span className="mb-1.5 block">{t('fields.body')}</span>
            <textarea rows={8} className={editorInput} value={text.body} maxLength={EDITORIAL_TEXT_LIMITS.body}
              onChange={event => changeTranslation(language, 'body', event.target.value)} />
          </label>
        </fieldset>
      })}
    </div>
    <fieldset className={panel}>
      <legend className={legend}>{t('source_heading')}</legend>
      {rows.map((source, index) => <div key={index} className="grid min-w-0 items-end gap-3 border-b border-line pb-3 sm:grid-cols-2">
        <TextField label={t('source_label', { number: index + 1 })} value={source.label}
          onChange={value => changeSource(index, 'label', value)} maxLength={EDITORIAL_SOURCE_LABEL_LIMIT} />
        <label className="min-w-0 text-sm font-medium text-ink2">
          <span className="mb-1.5 block">{t('source_url', { number: index + 1 })}</span>
          <input type="url" className={editorInput} value={source.url} maxLength={EDITORIAL_SOURCE_URL_LIMIT}
            onChange={event => changeSource(index, 'url', event.target.value)} />
        </label>
        {(rows.length > 1 || source.label || source.url) && <button type="button" className={`${editorButton} justify-self-start`}
          onClick={() => change({ ...draft, sources: rows.filter((_, position) => position !== index) })}>
          {t('source_remove', { number: index + 1 })}
        </button>}
      </div>)}
      <button type="button" className={editorButton} disabled={rows.length >= EDITORIAL_SOURCE_LIMIT}
        onClick={() => change({ ...draft, sources: [...rows, emptySource] })}>{t('source_add')}</button>
    </fieldset>
    {kind === 'neighborhood' ? <NeighborhoodEditorialFields value={draft.content.neighborhood} sources={draft.sources}
      onChange={neighborhood => change({ ...draft, content: { ...draft.content, neighborhood } })} /> : null}
    <div className={panel}>
      <label className="block text-sm font-medium text-ink2">
        <span className="mb-1.5 block">{t('review_note')}</span>
        <textarea rows={3} value={draft.review_note} maxLength={EDITORIAL_REVIEW_NOTE_LIMIT} className={editorInput} aria-describedby="editorial-review-note"
          onChange={event => change({ ...draft, review_note: event.target.value })} />
      </label>
      <p id="editorial-review-note" className="text-xs text-dim">{t('note_hint')}</p>
    </div>
  </>
}

export function EditorialPreviewContent({ entry, initialLanguage }: { entry: EditorialPreview; initialLanguage: EditorialLanguage }) {
  const { t } = useTranslation('editorial')
  const [language, setLanguage] = useState(initialLanguage)
  const text = entry.content[language]
  return <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="block min-w-0 max-w-full text-sm font-medium text-ink2">
        <span className="mb-1.5 block">{t('preview_language')}</span>
        <select className={editorInput} value={language} onChange={event => setLanguage(event.target.value as EditorialLanguage)}>
          {EDITORIAL_LANGUAGES.map(option => <option key={option} value={option}>{t(`languages.${option}`)}</option>)}
        </select>
      </label>
      <p className="pb-2 text-sm text-dim">{t('revision', { revision: entry.revision })}</p>
    </div>
    {!isTranslationComplete(text) && <p className="text-sm text-dim">{t('preview_incomplete')}</p>}
    <article lang={language} className={panel}>
      {text.title && <h3 className="break-words text-xl font-bold text-ink">{text.title}</h3>}
      {text.summary && <p className="whitespace-pre-wrap break-words text-sm text-ink2">{text.summary}</p>}
      {text.body && <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{text.body}</p>}
      {entry.content.neighborhood ? <NeighborhoodEditorialPreview value={entry.content.neighborhood}
        sources={entry.sources} language={language} /> : null}
      {entry.sources.length > 0 && <>
        <h4 className="text-sm font-bold text-ink">{t('source_heading')}</h4>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {entry.sources.map(({ label, url }, index) => <li key={index} className="break-words">
            {isPublicHttps(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sea underline">{label}</a> : label}
          </li>)}
        </ul>
      </>}
    </article>
    {entry.review_note && <aside className={panel}>
      <h3 className="text-sm font-bold text-ink">{t('review_note')}</h3>
      <p className="whitespace-pre-wrap break-words text-sm text-ink2">{entry.review_note}</p>
    </aside>}
  </div>
}
