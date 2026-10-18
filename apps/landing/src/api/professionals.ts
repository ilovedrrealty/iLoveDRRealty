import client from './axios'
import type { ProfessionalOptions, ProfessionalPage, PublicProfessional } from '../../../../packages/professionals/src'

export async function getProfessionalOptions(signal?: AbortSignal): Promise<ProfessionalOptions> {
  return (await client.get<ProfessionalOptions>('/professionals/options', { signal, withCredentials: false })).data
}
export async function getProfessionals(params: { category: string[]; area: string[]; q: string; limit: number; offset: number }, signal?: AbortSignal): Promise<ProfessionalPage<PublicProfessional>> {
  return (await client.get<ProfessionalPage<PublicProfessional>>('/professionals', { params, signal, withCredentials: false })).data
}
export async function getProfessional(id: string, signal?: AbortSignal): Promise<PublicProfessional> {
  return (await client.get<PublicProfessional>(`/professionals/${encodeURIComponent(id)}`, { signal, withCredentials: false })).data
}
