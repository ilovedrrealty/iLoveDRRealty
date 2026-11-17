import client from './axios'
import { isPublicHttps } from '../data/websiteEditorDefaults'
import { landingBaseUrl } from '../lib/siteUrls'

export const EDITORIAL_KINDS = ['article', 'guide', 'neighborhood'] as const
export const EDITORIAL_LANGUAGES = ['en', 'es'] as const
export const EDITORIAL_TEXT_LIMITS = { title: 160, summary: 350, body: 12000 }
export const EDITORIAL_SLUG_LIMIT = 80
export const EDITORIAL_SOURCE_LIMIT = 8
export const EDITORIAL_SOURCE_LABEL_LIMIT = 120
export const EDITORIAL_SOURCE_URL_LIMIT = 800
export const EDITORIAL_REVIEW_NOTE_LIMIT = 2000
export const EDITORIAL_PAGE_SIZE = 20

export type EditorialKind = typeof EDITORIAL_KINDS[number]
export type EditorialLanguage = typeof EDITORIAL_LANGUAGES[number]
export type EditorialText = Record<keyof typeof EDITORIAL_TEXT_LIMITS, string>
export type EditorialSource = { label: string; url: string }
export type EditorialDraft = {
  content: Record<EditorialLanguage, EditorialText>
  sources: EditorialSource[]
  review_note: string
}
export type EditorialDocument = {
  id: string
  slug: string
  kind: EditorialKind
  version: number
  draft_revision: number
  reviewed_revision: number | null
  published_revision: number | null
}
export type EditorialEntry = EditorialDocument & { title: string }
export type EditorialDetail = EditorialDocument & EditorialDraft
export type EditorialRevision = { revision: number; saved_at: string }
export type EditorialPreview = EditorialDraft & { revision: number }
export type EditorialAction = { action: 'review' | 'publish' | 'restore'; revision: number } | { action: 'unpublish' }

const PATH = '/admin/editorial'
const documentPath = (id: string) => `${PATH}/${encodeURIComponent(id)}`
const pagination = (page: number) => ({ page, page_size: EDITORIAL_PAGE_SIZE })

export async function listEditorial(page: number, signal: AbortSignal): Promise<EditorialEntry[]> {
  return (await client.get<{ items: EditorialEntry[] }>(PATH, { params: pagination(page), signal })).data.items
}
export async function getEditorial(id: string, signal: AbortSignal): Promise<EditorialDetail> {
  return (await client.get<EditorialDetail>(documentPath(id), { signal })).data
}
export async function listEditorialRevisions(id: string, page: number, signal: AbortSignal): Promise<EditorialRevision[]> {
  return (await client.get<{ items: EditorialRevision[] }>(`${documentPath(id)}/revisions`, { params: pagination(page), signal })).data.items
}
export async function previewEditorialRevision(id: string, revision: number, signal: AbortSignal): Promise<EditorialPreview> {
  return (await client.get<EditorialPreview>(`${documentPath(id)}/revisions/${revision}/preview`, { signal })).data
}
export async function createEditorial(slug: string, kind: EditorialKind, draft: EditorialDraft, signal: AbortSignal): Promise<EditorialDetail> {
  return (await client.post<EditorialDetail>(PATH, { slug, kind, ...draft }, { signal })).data
}
export async function saveEditorialDraft(id: string, version: number, draft: EditorialDraft, signal: AbortSignal): Promise<EditorialDetail> {
  return (await client.put<EditorialDetail>(`${documentPath(id)}/draft`, { expected_version: version, ...draft }, { signal })).data
}
export async function changeEditorialStatus(id: string, version: number, intent: EditorialAction, signal: AbortSignal): Promise<EditorialDetail> {
  const input = intent.action === 'unpublish'
    ? { expected_version: version }
    : { expected_version: version, revision: intent.revision }
  return (await client.post<EditorialDetail>(`${documentPath(id)}/${intent.action}`, input, { signal })).data
}

export function blankEditorialDraft(): EditorialDraft {
  return { content: { en: { title: '', summary: '', body: '' }, es: { title: '', summary: '', body: '' } }, sources: [], review_note: '' }
}

export function draftFromEditorial({ content, sources, review_note }: EditorialDraft): EditorialDraft {
  return { content, sources, review_note }
}

export function normalizeEditorialSources(sources: EditorialSource[]): EditorialSource[] | null {
  const rows = sources.map(({ label, url }) => ({ label: label.trim(), url: url.trim() }))
    .filter(({ label, url }) => label || url)
  return rows.length <= EDITORIAL_SOURCE_LIMIT
    && rows.every(({ label, url }) => label.length > 0 && label.length <= EDITORIAL_SOURCE_LABEL_LIMIT
      && url.length <= EDITORIAL_SOURCE_URL_LIMIT && !url.includes('\\') && isPublicHttps(url))
    ? rows : null
}

export function isTranslationComplete(text: EditorialText): boolean {
  return Object.values(text).every(value => value.trim().length > 0)
}

export function editorialActions(document: EditorialDetail) {
  const reviewable = EDITORIAL_LANGUAGES.every(language => isTranslationComplete(document.content[language]))
    && document.sources.length > 0
  return {
    review: reviewable && document.reviewed_revision !== document.draft_revision,
    publish: document.reviewed_revision === document.draft_revision && document.published_revision !== document.draft_revision,
    unpublish: document.published_revision !== null,
  }
}

export function publicEditorialLink(slug: string, language: EditorialLanguage, configuredLanding: string | undefined): string {
  const url = new URL('/local-guides/read/', landingBaseUrl(configuredLanding))
  url.search = new URLSearchParams({ slug, lang: language }).toString()
  return url.toString()
}
