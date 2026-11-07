import type { DomainData, DomainEvent } from '@/types/domain'
import { invariant } from '@/domain/errors'
import { orderTotal } from '@/domain/calculations'
const prefix = 'reference-4a-'
/** Explicit, additive fixture import; never changes an existing commercial record. */
export function addLogisticsReferenceScenario(data: DomainData, now: string) {
  const ids = [0, 1, 2, 3].map((i) => `${prefix}order-${i}`)
  if (ids.every((id) => data.orders.some((o) => o.id === id) && data.domainEvents.some((e) => e.aggregateId === id && e.metadata.fixture === 'logistics-4a-v1'))) return 'present' as const
  invariant(!Object.values(data).some((rows) => rows.some((row: { id: string }) => row.id.startsWith(prefix))), 'CONFLICT', 'Identificadores do cenário de referência já estão em uso.')
  const window = new Date(Date.parse(now) + 3 * 86400000).toISOString().slice(0, 10)
  const productId = data.products[0]?.id
  invariant(productId, 'VALIDATION', 'Cadastre um produto antes de importar o cenário.')
  let sequence = 0
  function event(aggregateType: DomainEvent['aggregateType'], aggregateId: string, eventType: DomainEvent['eventType'], metadata: Record<string, unknown>) {
    data.domainEvents.push({ id: `${prefix}event-${++sequence}`, aggregateType, aggregateId, eventType, timestamp: now, metadata: { synthetic: true, fixture: 'logistics-4a-v1', ...metadata } })
  }
  for (const [i, producerOrganizationId] of ['santa-clara', 'boa-esperanca', 'horizonte'].entries()) {
    invariant(data.organizations.some((o) => o.id === producerOrganizationId && o.active && o.type === 'producer'), 'VALIDATION', 'Organização necessária ao cenário não está disponível.')
    const productionId = `${prefix}production-${i}`, offerId = `${prefix}offer-${i}`
    data.productions.push({ id: productionId, producerOrganizationId, productId, estimatedQuantityKg: 500, harvestedQuantityKg: 500, expectedHarvestDate: now.slice(0, 10), status: 'harvested', createdAt: now, updatedAt: now })
    event('production', productionId, 'production_created', { actorOrganizationId: producerOrganizationId, toStatus: 'harvested' })
    data.offers.push({ id: offerId, productionId, producerOrganizationId, quantityKg: 500, pricePerKg: 4, availabilityType: 'immediate', availableFrom: now.slice(0, 10), status: 'published', createdAt: now, updatedAt: now })
    event('offer', offerId, 'offer_created', { actorOrganizationId: producerOrganizationId, toStatus: 'draft' })
    event('offer', offerId, 'offer_published', { actorOrganizationId: producerOrganizationId, fromStatus: 'draft', toStatus: 'published' })
  }
  invariant(data.organizations.some((o) => o.id === 'bom-preco' && o.active && o.type === 'buyer'), 'VALIDATION', 'Comprador de referência não está disponível.')
  for (let i = 0; i < 4; i++) {
    const producerIndex = i === 3 ? 0 : i
    const producerOrganizationId = ['santa-clara', 'boa-esperanca', 'horizonte'][producerIndex]
    const quantityKg = [200, 150, 250, 100][i]
    const id = ids[i]
    data.orders.push({ id, offerId: `${prefix}offer-${producerIndex}`, producerOrganizationId, buyerOrganizationId: 'bom-preco', quantityKg, unitPrice: 4, totalAmount: orderTotal(quantityKg, 4), status: 'confirmed', requestedAt: now, updatedAt: now, delivery: {
      origin: { label: `Origem sintética ${producerIndex + 1}`, city: ['Campinas', 'Valinhos', 'Indaiatuba'][producerIndex], state: 'SP', coordinates: { latitude: -22.9 - producerIndex * 0.02, longitude: -47.06 - producerIndex * 0.02, source: 'synthetic' } },
      destination: { label: `Destino sintético ${i + 1}`, city: 'Campinas', state: 'SP', coordinates: { latitude: -22.86 - i * 0.005, longitude: -47.04 - i * 0.005, source: 'synthetic' } },
      windowStart: window, windowEnd: window, weightKg: quantityKg, referenceDistanceKm: 30 + i * 2, restrictions: ['ambient'],
    } })
    event('order', id, 'order_requested', { actorOrganizationId: 'bom-preco', fromStatus: null, toStatus: 'pending_confirmation' })
    event('order', id, 'order_confirmed', { actorOrganizationId: producerOrganizationId, fromStatus: 'pending_confirmation', toStatus: 'confirmed' })
  }
  return 'added' as const
}
