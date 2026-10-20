import client from './axios'
import type { ProfessionalOptions } from '../../../../packages/professionals/src'

export async function getProfessionalOptions(signal?: AbortSignal): Promise<ProfessionalOptions> {
  return (await client.get<ProfessionalOptions>('/professionals/options', { signal, withCredentials: false })).data
}
