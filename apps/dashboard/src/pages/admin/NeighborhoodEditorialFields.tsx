import { useTranslation } from 'react-i18next'
import {
  NEIGHBORHOOD_FACT_LIMIT, NEIGHBORHOOD_LOCATION_LIMIT, NEIGHBORHOOD_TOPICS, type NeighborhoodTopic,
} from '../../../../../packages/editorial-neighborhoods'
import { EDITORIAL_LANGUAGES, normalizeEditorialSources, type EditorialLanguage, type EditorialNeighborhood, type EditorialSource } from '../../api/editorial'
import { isPublicHttps } from '../../data/websiteEditorDefaults'
import { editorButton, editorInput, TextField } from './WebsiteEditorFields'

type Fact = EditorialNeighborhood['facts'][number]
const panel = 'min-w-0 space-y-3 rounded-xl border border-line bg-white p-4'
const legend = 'px-1 text-base font-bold text-ink'
const field = 'block min-w-0 text-sm font-medium text-ink2'

export function NeighborhoodEditorialFields({ value, sources, onChange }: {
  value?: EditorialNeighborhood | null; sources: EditorialSource[]; onChange: (value: EditorialNeighborhood | null) => void
}) {
  const { t } = useTranslation('editorial', { keyPrefix: 'neighborhood_comparison' })
  const facts = value?.facts ?? []
  const claimedTopics = new Set(facts.map(fact => fact.topic))
  const nextTopic = NEIGHBORHOOD_TOPICS.find(topic => !claimedTopics.has(topic))
  const availableSources = sources.flatMap(source => normalizeEditorialSources([source]) ?? [])
  const currentSources = [...new Map(availableSources.map(source => [source.url, source])).values()]
  function add() {
    if (nextTopic) onChange({
      listing_location: value?.listing_location ?? null,
      facts: [...facts, { topic: nextTopic, en: '', es: '', checked_on: '', source_url: '' }],
    })
  }
  function update(index: number, fields: Partial<Fact>) {
    if (value) onChange({ ...value, facts: facts.map((fact, position) => index === position ? { ...fact, ...fields } : fact) })
  }
  function remove(index: number) {
    if (value) onChange(facts.length > 1 ? { ...value, facts: facts.filter((_, position) => position !== index) } : null)
  }
  return <fieldset className={panel}>
    <legend className={legend}>{t('heading')}</legend>
    <p className="text-sm text-ink2">{t('help')}</p>
    {value ? <>
      <div className="space-y-1">
        <TextField label={t('location')} value={value.listing_location ?? ''} maxLength={NEIGHBORHOOD_LOCATION_LIMIT}
          onChange={location => onChange({ ...value, listing_location: location || null })} />
        <p className="text-xs text-dim">{t('location_help')}</p>
      </div>
      {facts.map((fact, index) => {
        const unavailable = Boolean(fact.source_url && !currentSources.some(source => source.url === fact.source_url))
        return <fieldset key={index} className="min-w-0 space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-bold">{t('fact', { number: index + 1 })}</legend>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <label className={field}>
              <span className="mb-1.5 block">{t('topic')}</span>
              <select className={editorInput} value={fact.topic} onChange={event => update(index, { topic: event.target.value as NeighborhoodTopic })}>
                {NEIGHBORHOOD_TOPICS.map(topic => <option key={topic} value={topic} disabled={topic !== fact.topic && claimedTopics.has(topic)}>{t(`topics.${topic}`)}</option>)}
              </select>
            </label>
            <label className={field}>
              <span className="mb-1.5 block">{t('checked_on')}</span>
              <input type="date" className={editorInput} value={fact.checked_on} onChange={event => update(index, { checked_on: event.target.value })} />
            </label>
            {EDITORIAL_LANGUAGES.map(language => <label className={field} key={language}>
              <span className="mb-1.5 block">{t(`text.${language}`)}</span>
              <textarea className={editorInput} maxLength={NEIGHBORHOOD_FACT_LIMIT} rows={3} value={fact[language]}
                onChange={event => update(index, { [language]: event.target.value })} />
            </label>)}
          </div>
          <label className={field}>
            <span className="mb-1.5 block">{t('source')}</span>
            <select className={editorInput} value={fact.source_url} onChange={event => update(index, { source_url: event.target.value })}>
              <option value="">{t('choose_source')}</option>
              {unavailable ? <option value={fact.source_url} disabled>{t('source_removed')}</option> : null}
              {currentSources.map(source => <option key={source.url} value={source.url}>{source.label}</option>)}
            </select>
          </label>
          <button type="button" className={editorButton} onClick={() => remove(index)}>{t('remove', { number: index + 1 })}</button>
        </fieldset>
      })}
    </> : null}
    <div className="flex flex-wrap gap-2">
      {nextTopic ? <button type="button" className={editorButton} onClick={add}>{t('add')}</button> : null}
      {value ? <button type="button" className={editorButton} onClick={() => onChange(null)}>{t('clear')}</button> : null}
    </div>
  </fieldset>
}

export function NeighborhoodEditorialPreview({ value, sources, language }: {
  value: EditorialNeighborhood; sources: EditorialSource[]; language: EditorialLanguage
}) {
  const { t } = useTranslation('editorial', { keyPrefix: 'neighborhood_comparison' })
  return <section className="space-y-3 border-t border-line pt-3">
    <h4 className="font-bold text-ink">{t('heading', { lng: language })}</h4>
    {value.listing_location ? <p className="text-sm text-ink2">{t('location', { lng: language })} · {value.listing_location}</p> : null}
    <dl className="space-y-3">
      {value.facts.map(fact => {
        const source = sources.find(entry => entry.url === fact.source_url)
        return <div key={fact.topic} className="space-y-1">
          <dt className="text-sm font-semibold text-ink">{t(`topics.${fact.topic}`, { lng: language })}</dt>
          <dd className="whitespace-pre-wrap text-sm text-ink2 [overflow-wrap:anywhere]">{fact[language]}</dd>
          <dd className="text-xs text-dim">{t('checked_on', { lng: language })} <time dateTime={fact.checked_on}>{fact.checked_on}</time></dd>
          {source && isPublicHttps(source.url) ? <dd><a href={source.url} target="_blank" rel="noopener noreferrer"
            className="text-sm text-sea underline [overflow-wrap:anywhere]">{source.label}</a></dd> : null}
        </div>
      })}
    </dl>
  </section>
}
