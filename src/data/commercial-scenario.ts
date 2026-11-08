import { referencePartners } from '@/data/logistics-reference'
import { workspaces } from '@/data/workspaces'
import { orderTotal } from '@/domain/calculations'
import type { DomainData, DomainEvent, EventType, Order, OrderStatus } from '@/types/domain'

// Fixed, reproducible synthetic fixtures; these are never claimed as observed market data.
const createdAt = '2026-11-01T08:00:00.000Z'
const updatedAt = '2026-11-04T16:00:00.000Z'
export function createInitialScenario(referenceDate = '2026-11-07T12:00:00.000Z'): DomainData {
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
      { id: 'tomate-italiano', name: 'Tomate Italiano', category: 'Hortaliças', unit: 'kg' },
      { id: 'alface-crespa', name: 'Alface Crespa', category: 'Hortaliças', unit: 'kg' },
      { id: 'cenoura', name: 'Cenoura', category: 'Hortaliças', unit: 'kg' },
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
  // Cumulative windows from the same reference date; constant synthetic daily rates.
  // Region includes Campinas, Valinhos and Indaiatuba; no municipal disaggregation.
  const fixtures = [
    { productId: 'tomate-italiano', demand: 240, supply: 200, price: 4.5, trend: 'growing' as const },
    { productId: 'alface-crespa', demand: 100, supply: 100, price: 3, trend: 'stable' as const },
    { productId: 'cenoura', demand: 150, supply: 200, price: 2.8, trend: 'declining' as const },
    { productId: 'batata', demand: 7000 / 30, supply: 6700 / 30, price: 3.2, trend: 'stable' as const },
  ]
  for (const fixture of fixtures) {
    for (const periodDays of [7, 15, 30]) {
      if (data.marketAnalyses.some((row) => row.productId === fixture.productId && row.periodDays === periodDays)) continue
      data.marketAnalyses.push({
        id: `analysis-${fixture.productId}-${periodDays}`, productId: fixture.productId,
        region: 'Região de Campinas/SP', periodDays,
        estimatedDemandKg: Math.round(fixture.demand * periodDays * 1000) / 1000,
        estimatedSupplyKg: Math.round(fixture.supply * periodDays * 1000) / 1000,
        referencePricePerKg: fixture.price, trend: fixture.trend, calculatedAt: updatedAt,
        methodology: 'Cenário sintético demonstrativo. Taxas diárias fixas acumuladas em 7, 15 ou 30 dias a partir da mesma referência; Campinas, Valinhos e Indaiatuba. Não representa dados observados ou previsões reais.',
      })
    }
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
  // Completed synthetic lots consume their own harvested stock, never today's offers.
  // Only the new history is relative to this reference; legacy fixtures stay unchanged.
  const history = [
    { daysAgo: 25, producer: 'santa-clara', buyer: 'bom-preco', product: 'tomate', quantity: 120, price: 4.5 },
    { daysAgo: 18, producer: 'boa-esperanca', buyer: 'bom-preco', product: 'batata', quantity: 150, price: 3.2 },
    { daysAgo: 12, producer: 'santa-clara', buyer: 'restaurante-central', product: 'tomate', quantity: 80, price: 4.5 },
    { daysAgo: 7, producer: 'santa-clara', buyer: 'bom-preco', product: 'tomate', quantity: 200, price: 4.5 },
    { daysAgo: 3, producer: 'santa-clara', buyer: 'bom-preco', product: 'tomate', quantity: 100, price: 4.5 },
  ]
  function historyTime(daysAgo: number, hour: number) {
    const date = new Date(referenceDate)
    date.setUTCDate(date.getUTCDate() - daysAgo)
    date.setUTCHours(hour, 0, 0, 0)
    return date.toISOString()
  }
  for (const [index, fixture] of history.entries()) {
    const suffix = String(index + 1).padStart(2, '0')
    const productionId = `history-production-${suffix}`, offerId = `history-offer-${suffix}`
    const id = `history-order-${suffix}`, operationId = `history-logistics-${suffix}`
    const requestedAt = historyTime(fixture.daysAgo + 2, 8)
    const confirmedAt = historyTime(fixture.daysAgo + 2, 9)
    const preparingAt = historyTime(fixture.daysAgo + 1, 7)
    const transportAt = historyTime(fixture.daysAgo + 1, 8)
    const dispatchedAt = historyTime(fixture.daysAgo + 1, 10)
    const deliveredAt = historyTime(fixture.daysAgo, 10)
    const harvestedAt = historyTime(fixture.daysAgo + 3, 7)
    data.productions.push({ id: productionId, producerOrganizationId: fixture.producer, productId: fixture.product, estimatedQuantityKg: fixture.quantity, harvestedQuantityKg: fixture.quantity, expectedHarvestDate: harvestedAt.slice(0, 10), status: 'finished', createdAt: harvestedAt, updatedAt: deliveredAt })
    data.offers.push({ id: offerId, productionId, producerOrganizationId: fixture.producer, quantityKg: fixture.quantity, pricePerKg: fixture.price, availabilityType: 'immediate', availableFrom: harvestedAt.slice(0, 10), status: 'closed', createdAt: harvestedAt, updatedAt: deliveredAt })
    const row: Order = { id, offerId, producerOrganizationId: fixture.producer, buyerOrganizationId: fixture.buyer, quantityKg: fixture.quantity, unitPrice: fixture.price, totalAmount: orderTotal(fixture.quantity, fixture.price), status: 'delivered', requestedAt, updatedAt: deliveredAt }
    data.orders.push(row)
    data.logistics.push({ id: operationId, partnerOrganizationId: 'rotas-do-campo', orderIds: [id], transportMode: 'individual', vehicleCapacityKg: 1000, totalLoadKg: fixture.quantity, estimatedCost: 120, status: 'delivered', createdAt: transportAt, updatedAt: deliveredAt })
    function historyEvent(aggregateType: DomainEvent['aggregateType'], aggregateId: string, type: EventType, time: string, metadata: Record<string, unknown>) {
      event(aggregateType, aggregateId, type, time, { fixture: 'commercial-history-v1', ...metadata })
    }
    historyEvent('production', productionId, 'production_created', harvestedAt, { actorOrganizationId: fixture.producer, toStatus: 'harvested', quantityKg: fixture.quantity })
    historyEvent('offer', offerId, 'offer_created', harvestedAt, { actorOrganizationId: fixture.producer, toStatus: 'draft', quantityKg: fixture.quantity, pricePerKg: fixture.price })
    historyEvent('offer', offerId, 'offer_published', harvestedAt, { actorOrganizationId: fixture.producer, fromStatus: 'draft', toStatus: 'published' })
    // Reuse the commercial metadata and transition contracts of the original seed.
    orderEvent(row, 'order_requested', null, 'pending_confirmation', requestedAt)
    orderEvent(row, 'order_confirmed', 'pending_confirmation', 'confirmed', confirmedAt)
    orderEvent(row, 'order_preparing', 'confirmed', 'preparing', preparingAt)
    historyEvent('logistics', operationId, 'logistics_created', transportAt, { actorOrganizationId: 'rotas-do-campo', toStatus: 'awaiting_organization', orderIds: [id] })
    historyEvent('logistics', operationId, 'logistics_transport_requested', transportAt, { actorOrganizationId: 'rotas-do-campo', fromStatus: 'awaiting_organization', toStatus: 'transport_requested' })
    historyEvent('order', id, 'transport_requested', transportAt, { actorOrganizationId: 'rotas-do-campo', logisticsOperationId: operationId, fromStatus: 'preparing', toStatus: 'preparing' })
    historyEvent('logistics', operationId, 'logistics_dispatched', dispatchedAt, { actorOrganizationId: 'rotas-do-campo', fromStatus: 'transport_requested', toStatus: 'in_transit' })
    historyEvent('order', id, 'order_dispatched', dispatchedAt, { actorOrganizationId: 'rotas-do-campo', logisticsOperationId: operationId, fromStatus: 'preparing', toStatus: 'in_transit' })
    historyEvent('logistics', operationId, 'logistics_delivered', deliveredAt, { actorOrganizationId: 'rotas-do-campo', fromStatus: 'in_transit', toStatus: 'delivered' })
    historyEvent('order', id, 'order_delivered', deliveredAt, { actorOrganizationId: 'rotas-do-campo', logisticsOperationId: operationId, fromStatus: 'in_transit', toStatus: 'delivered' })
    historyEvent('offer', offerId, 'offer_closed', deliveredAt, { actorOrganizationId: fixture.producer, fromStatus: 'published', toStatus: 'closed' })
    historyEvent('production', productionId, 'production_updated', deliveredAt, { actorOrganizationId: fixture.producer, fromStatus: 'harvested', toStatus: 'finished' })
  }
  data.domainEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  for (const org of data.organizations) if (referencePartners[org.id]) org.logisticsProfile = structuredClone(referencePartners[org.id])
  return data
}
