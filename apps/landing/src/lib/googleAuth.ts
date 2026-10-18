// This public identifier is supplied at build time; email authentication also works without it.
export const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '').trim()
