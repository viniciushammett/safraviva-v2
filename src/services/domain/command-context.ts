import { invariant } from '@/domain/errors'
import type { AggregateType, DomainData, EventType, OrganizationType } from '@/types/domain'

export interface CommandEnvironment { now: () => string; id: () => string }
export const defaultEnvironment: CommandEnvironment = { now: () => new Date().toISOString(), id: () => crypto.randomUUID() }
export function requireOrganization(data: DomainData, id: string, type: OrganizationType) {
  const organization = data.organizations.find((row) => row.id === id)
  invariant(organization?.active && organization.type === type, 'FORBIDDEN', 'Organização inativa, inexistente ou incompatível com esta operação.')
  return organization
}
export function findRecord<T extends { id: string }>(rows: readonly T[], id: string): T {
  const record = rows.find((row) => row.id === id)
  invariant(record, 'NOT_FOUND', `Registro não encontrado: ${id}.`)
  return record
}
export function requireOwner(actualId: string, actorId: string) {
  invariant(actualId === actorId, 'FORBIDDEN', 'Esta operação pertence a outra organização.')
}
export function recordEvent(data: DomainData, env: CommandEnvironment, aggregateType: AggregateType, aggregateId: string, eventType: EventType, metadata: Record<string, unknown>, timestamp = env.now()) {
  data.domainEvents.push({ id: env.id(), aggregateType, aggregateId, eventType, timestamp, metadata })
}
