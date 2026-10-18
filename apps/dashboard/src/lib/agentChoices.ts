import type { AdminAgent } from '../api/admin'

export type AgentRoleLabels = Record<AdminAgent['role'], string>
export const agentName = (agent: AdminAgent) => agent.display_name?.trim() || agent.email
export const agentChoiceLabel = (agent: AdminAgent, labels: AgentRoleLabels) => `${agentName(agent)} · ${labels[agent.role]}`
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()

export function filterAgentChoices(agents: AdminAgent[], query: string, labels: AgentRoleLabels): AdminAgent[] {
  const needle = normalize(query)
  return agents.filter(agent => normalize(`${agentName(agent)} ${agent.email} ${agent.role} ${labels[agent.role]}`).includes(needle))
}
