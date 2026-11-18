const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '')

export type NewsletterLanguage = 'en' | 'es'
export type NewsletterAction = 'confirm' | 'unsubscribe'
type NewsletterStatus = 'accepted' | 'subscribed' | 'unsubscribed'
type NewsletterErrorCode = 'invalid' | 'rate_limited' | 'unavailable'

export class NewsletterRequestError extends Error {
  constructor(readonly code: NewsletterErrorCode) {
    super(code)
  }
}

const TOKEN = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[0-9a-f]{64}$/

export function readNewsletterLink(fragment: string): { action: NewsletterAction; token: string } | null {
  if (fragment.length > 300) return null
  const match = /^#(confirm|unsubscribe)=([^#&=?]+)$/.exec(fragment)
  if (!match || !TOKEN.test(match[2])) return null
  return { action: match[1] === 'confirm' ? 'confirm' : 'unsubscribe', token: match[2] }
}

async function request(
  action: 'subscribe' | NewsletterAction,
  body: { email: string; consent: true; language: NewsletterLanguage } | { token: string },
  httpStatus: 200 | 202,
  expected: NewsletterStatus,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(API + '/newsletter/' + action, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      cache: 'no-store',
      body: JSON.stringify(body),
    })
  } catch {
    throw new NewsletterRequestError('unavailable')
  }
  if (response.status === 429) throw new NewsletterRequestError('rate_limited')
  if (response.status === 400 || response.status === 422) throw new NewsletterRequestError('invalid')
  if (response.status !== httpStatus) throw new NewsletterRequestError('unavailable')

  const payload: unknown = await response.json().catch(() => null)
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)
    || Object.keys(payload).length !== 1 || !('status' in payload) || payload.status !== expected) {
    throw new NewsletterRequestError('unavailable')
  }
}

export function subscribeToNewsletter(email: string, language: NewsletterLanguage): Promise<void> {
  return request('subscribe', { email: email.trim(), consent: true, language }, 202, 'accepted')
}

export async function applyNewsletterAction(action: NewsletterAction, token: string): Promise<void> {
  if (!TOKEN.test(token)) throw new NewsletterRequestError('invalid')
  await request(action, { token }, 200, action === 'confirm' ? 'subscribed' : 'unsubscribed')
}
