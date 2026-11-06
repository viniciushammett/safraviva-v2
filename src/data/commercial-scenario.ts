import { workspaces } from '@/data/workspaces'
import { orderTotal } from '@/domain/calculations'
import type { DomainData, DomainEvent, EventType, Order, OrderStatus } from '@/types/domain'

// Fixed, reproducible synthetic fixtures; these are never claimed as observed market data.
const createdAt = '2026-11-01T08:00:00.000Z'
const updatedAt = '2026-11-04T16:00:00.000Z'
export function createInitialScenario(): DomainData {
  const data: DomainData = {
    organizations: [
      ...workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name, type: workspace.profile, city: 'Campinas', state: 'SP', active: true })),
      { id: 'boa-esperanca', name: 'Sítio Boa Esperança', type: 'producer', city: 'Valinhos', state: 'SP', active: true },
      { id: 'horizonte', name: 'Fazenda Horizonte', type: 'producer', city: 'Indaiatuba', state: 'SP', active: true },
      { id: 'restaurante-central', name: 'Restaurante Central', type: 'buyer', city: 'Campinas', state: 'SP', active: true },
      { id: 'hortifruti-regional', name: 'Hortifruti Regional', type: 'buyer', city: 'Valinhos', state: 'SP', active: true },
      { id: 'rotas-do-campo', name: 'Rotas do Campo Transportes', type: 'logistics_partner', city: 'Campinas', state: 'SP', active: true },
      { id: 'carga-verde', name: 'Carga Verde Logística', type: 'logistics_partner', city: 'Valinhos', state: 'SP', active: true },
    ],
    users: [
      ...workspaces.map((workspace) => ({ id: workspace.id === 'santa-clara' ? 'joao-oliveira' : 'mariana-costa', organizationId: workspace.id, name: workspace.user.name, role: workspace.user.role, active: true })),
      { id: 'ana-souza', organizationId: 'boa-esperanca', name: 'Ana Souza', role: 'Administradora', active: true },
      { id: 'pedro-lima', organizationId: 'horizonte', name: 'Pedro Lima', role: 'Administrador', active: true },
      { id: 'carlos-santos', organizationId: 'restaurante-central', name: 'Carlos Santos', role: 'Comprador', active: true },
      { id: 'beatriz-alves', organizationId: 'hortifruti-regional', name: 'Beatriz Alves', role: 'Compradora', active: true },
      { id: 'lucas-rocha', organizationId: 'rotas-do-campo', name: 'Lucas Rocha', role: 'Coordenador', active: true },
      { id: 'paula-costa', organizationId: 'carga-verde', name: 'Paula Costa', role: 'Coordenadora', active: true },
    ],
    products: [
      { id: 'tomate', name: 'Tomate', category: 'Hortaliças', unit: 'kg' },
      { id: 'batata', name: 'Batata', category: 'Tubérculos', unit: 'kg' },
      { id: 'milho', name: 'Milho', category: 'Grãos', unit: 'kg' },
    ],
    productions: [
      { id: 'prod-tomate-sc', producerOrganizationId: 'santa-clara', productId: 'tomate', estimatedQuantityKg: 2000, harvestedQuantityKg: 1800, expectedHarvestDate: '2026-11-01', status: 'harvested', createdAt, updatedAt },
      { id: 'prod-milho-sc', producerOrganizationId: 'santa-clara', productId: 'milho', estimatedQuantityKg: 5000, harvestedQuantityKg: 0, expectedHarvestDate: '2026-11-25', status: 'growing', createdAt, updatedAt },
      { id: 'prod-batata-be', producerOrganizationId: 'boa-esperanca', productId: 'batata', estimatedQuantityKg: 1500, harvestedQuantityKg: 1400, expectedHarvestDate: '2026-11-01', status: 'harvested', createdAt, updatedAt },
      { id: 'prod-milho-hz', producerOrganizationId: 'horizonte', productId: 'milho', estimatedQuantityKg: 3000, harvestedQuantityKg: 2900, expectedHarvestDate: '2026-11-01', status: 'finished', createdAt, updatedAt },
    ],
    offers: [
      { id: 'offer-tomate', productionId: 'prod-tomate-sc', producerOrganizationId: 'santa-clara', quantityKg: 1200, pricePerKg: 4.5, availabilityType: 'immediate', availableFrom: '2026-11-01', status: 'published', createdAt, updatedAt },
      { id: 'offer-tomate-draft', productionId: 'prod-tomate-sc', producerOrganizationId: 'santa-clara', quantityKg: 300, pricePerKg: 4.8, availabilityType: 'immediate', availableFrom: '2026-11-01', status: 'draft', createdAt, updatedAt },
      { id: 'offer-milho-future', productionId: 'prod-milho-sc', producerOrganizationId: 'santa-clara', quantityKg: 2500, pricePerKg: 1.2, availabilityType: 'future', availableFrom: '2026-11-25', status: 'published', createdAt, updatedAt },
      { id: 'offer-batata', productionId: 'prod-batata-be', producerOrganizationId: 'boa-esperanca', quantityKg: 1000, pricePerKg: 3.2, availabilityType: 'immediate', availableFrom: '2026-11-01', status: 'published', createdAt, updatedAt },
      { id: 'offer-milho-closed', productionId: 'prod-milho-hz', producerOrganizationId: 'horizonte', quantityKg: 800, pricePerKg: 1.1, availabilityType: 'immediate', availableFrom: '2026-11-01', status: 'closed', createdAt, updatedAt },
    ],
    orders: [], logistics: [], domainEvents: [], commandReceipts: [],
    marketAnalyses: ['tomate', 'batata', 'milho'].map((productId, index) => ({ id: `analysis-${productId}`, productId, region: 'Região de Campinas/SP', periodDays: 30, estimatedDemandKg: 6000 + index * 1000, estimatedSupplyKg: 5500 + index * 1200, referencePricePerKg: [4.5, 3.2, 1.2][index], trend: index === 0 ? 'growing' : index === 1 ? 'stable' : 'declining', calculatedAt: updatedAt, methodology: 'Cenário sintético demonstrativo, com valores fixos para testes. Não representa medições, cotações ou previsões reais de mercado.' })),
  }
  function order(id: string, offerId: string, buyerOrganizationId: string, quantityKg: number, status: OrderStatus) {
    const offer = data.offers.find((row) => row.id === offerId)!
    data.orders.push({ id, offerId, producerOrganizationId: offer.producerOrganizationId, buyerOrganizationId, quantityKg, unitPrice: offer.pricePerKg, totalAmount: orderTotal(quantityKg, offer.pricePerKg), status, requestedAt: '2026-11-02T08:00:00.000Z', updatedAt })
  }
  order('order-pending', 'offer-tomate', 'bom-preco', 200, 'pending_confirmation')
  order('order-confirmed', 'offer-tomate', 'restaurante-central', 100, 'confirmed')
  order('order-preparing', 'offer-tomate', 'hortifruti-regional', 150, 'preparing')
  order('order-transit', 'offer-batata', 'bom-preco', 300, 'in_transit')
  order('order-delivered', 'offer-milho-closed', 'hortifruti-regional', 800, 'delivered')
  order('order-rejected', 'offer-tomate', 'bom-preco', 50, 'rejected')
  order('order-cancelled', 'offer-batata', 'restaurante-central', 60, 'cancelled')
  order('order-future', 'offer-milho-future', 'bom-preco', 400, 'pending_confirmation')
  data.logistics.push(
    { id: 'logistics-transit', partnerOrganizationId: 'rotas-do-campo', orderIds: ['order-transit'], transportMode: 'individual', vehicleCapacityKg: 1000, totalLoadKg: 300, estimatedCost: 160, status: 'in_transit', createdAt: '2026-11-03T08:00:00.000Z', updatedAt },
    { id: 'logistics-delivered', partnerOrganizationId: 'carga-verde', orderIds: ['order-delivered'], transportMode: 'individual', vehicleCapacityKg: 1200, totalLoadKg: 800, estimatedCost: 240, status: 'delivered', createdAt: '2026-11-03T08:00:00.000Z', updatedAt },
    { id: 'logistics-planned', partnerOrganizationId: 'rotas-do-campo', orderIds: ['order-confirmed', 'order-preparing'], transportMode: 'shared', vehicleCapacityKg: 800, totalLoadKg: 250, estimatedCost: 180, status: 'awaiting_organization', createdAt: '2026-11-03T08:00:00.000Z', updatedAt },
  )
  function event(aggregateType: DomainEvent['aggregateType'], aggregateId: string, eventType: EventType, timestamp: string, metadata: Record<string, unknown>) {
    data.domainEvents.push({ id: `seed-event-${data.domainEvents.length + 1}`, aggregateType, aggregateId, eventType, timestamp, metadata: { synthetic: true, ...metadata } })
  }
  for (const production of data.productions) event('production', production.id, 'production_created', createdAt, { actorOrganizationId: production.producerOrganizationId, toStatus: production.status === 'finished' ? 'harvested' : production.status, quantityKg: production.estimatedQuantityKg })
  for (const offer of data.offers) {
    event('offer', offer.id, 'offer_created', createdAt, { actorOrganizationId: offer.producerOrganizationId, toStatus: 'draft', quantityKg: offer.quantityKg, pricePerKg: offer.pricePerKg })
    if (offer.status !== 'draft') event('offer', offer.id, 'offer_published', '2026-11-01T09:00:00.000Z', { actorOrganizationId: offer.producerOrganizationId, fromStatus: 'draft', toStatus: 'published' })
  }
  function orderEvent(order: Order, type: EventType, fromStatus: string | null, toStatus: string, time: string) {
    event('order', order.id, type, time, { actorOrganizationId: type === 'order_requested' || type === 'order_cancelled' ? order.buyerOrganizationId : order.producerOrganizationId, fromStatus, toStatus, quantityKg: order.quantityKg, unitPrice: order.unitPrice, totalAmount: order.totalAmount })
  }
  for (const row of data.orders) {
    orderEvent(row, 'order_requested', null, 'pending_confirmation', row.requestedAt)
    if (row.status === 'rejected' || row.status === 'cancelled') orderEvent(row, row.status === 'rejected' ? 'order_rejected' : 'order_cancelled', 'pending_confirmation', row.status, updatedAt)
    else if (row.status !== 'pending_confirmation') {
      orderEvent(row, 'order_confirmed', 'pending_confirmation', 'confirmed', '2026-11-02T09:00:00.000Z')
      if (row.status !== 'confirmed') orderEvent(row, 'order_preparing', 'confirmed', 'preparing', '2026-11-03T07:00:00.000Z')
    }
  }
  for (const operation of data.logistics) {
    event('logistics', operation.id, 'logistics_created', operation.createdAt, { actorOrganizationId: operation.partnerOrganizationId, toStatus: 'awaiting_organization', orderIds: operation.orderIds })
    if (operation.status !== 'awaiting_organization') {
      event('logistics', operation.id, 'logistics_transport_requested', operation.createdAt, { actorOrganizationId: operation.partnerOrganizationId, fromStatus: 'awaiting_organization', toStatus: 'transport_requested' })
      for (const id of operation.orderIds) event('order', id, 'transport_requested', operation.createdAt, { actorOrganizationId: operation.partnerOrganizationId, logisticsOperationId: operation.id, fromStatus: 'preparing', toStatus: 'preparing' })
      event('logistics', operation.id, 'logistics_dispatched', '2026-11-03T10:00:00.000Z', { actorOrganizationId: operation.partnerOrganizationId, fromStatus: 'transport_requested', toStatus: 'in_transit' })
      for (const id of operation.orderIds) event('order', id, 'order_dispatched', '2026-11-03T10:00:00.000Z', { actorOrganizationId: operation.partnerOrganizationId, logisticsOperationId: operation.id, fromStatus: 'preparing', toStatus: 'in_transit' })
      if (operation.status === 'delivered') {
        event('logistics', operation.id, 'logistics_delivered', updatedAt, { actorOrganizationId: operation.partnerOrganizationId, fromStatus: 'in_transit', toStatus: 'delivered' })
        for (const id of operation.orderIds) event('order', id, 'order_delivered', updatedAt, { actorOrganizationId: operation.partnerOrganizationId, logisticsOperationId: operation.id, fromStatus: 'in_transit', toStatus: 'delivered' })
      }
    }
  }
  for (const offer of data.offers.filter((row) => row.status === 'closed')) event('offer', offer.id, 'offer_closed', updatedAt, { actorOrganizationId: offer.producerOrganizationId, fromStatus: 'published', toStatus: 'closed' })
  for (const production of data.productions.filter((row) => row.status === 'finished')) event('production', production.id, 'production_updated', updatedAt, { actorOrganizationId: production.producerOrganizationId, fromStatus: 'harvested', toStatus: 'finished' })
  data.domainEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  return data
}
