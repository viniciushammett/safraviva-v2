import { describe, expect, it } from 'vitest'
import { createInitialScenario } from './commercial-scenario'
import { allocatedProductionQuantity, availableQuantity, committedQuantity, orderTotal } from '@/domain/calculations'
import { validateDomainData } from '@/domain/integrity'
import { validateOrderHistory } from '@/domain/order-history'
import { availableCatalog, availableProductionKg, supplierDirectory } from '@/domain/operational-analytics'
import { DOMAIN_SCHEMA_VERSION, DOMAIN_STORAGE_KEY, LocalDomainDatabase } from '@/repositories/local/domain-database'
import { SUPPLIER_FAVORITES_KEY } from '@/repositories/supplier-favorites-repository'
import { CommercialService } from '@/services/domain/commercial-service'
import { DashboardService } from '@/services/domain/dashboard-service'
import { LogisticsService } from '@/services/domain/logistics-service'
import type { DomainData } from '@/types/domain'

const now = '2026-11-07T12:00:00.000Z'
const historicalOrders = (data: DomainData) => data.orders.filter((o) => o.id.startsWith('history-'))
// Model a valid browser saved before this hotfix, without any automatic import.
function previousScenario() {
  const data = createInitialScenario()
  data.orders = data.orders.filter((o) => !o.id.startsWith('history-'))
  data.offers = data.offers.filter((o) => !o.id.startsWith('history-'))
  data.productions = data.productions.filter((p) => !p.id.startsWith('history-'))
  data.logistics = data.logistics.filter((l) => !l.id.startsWith('history-'))
  data.domainEvents = data.domainEvents.filter((e) => !e.aggregateId.startsWith('history-'))
  return validateDomainData(data)
}
function memoryStorage() {
  const values = new Map<string, string>()
  let writes = 0
  return { values, get writes() { return writes }, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes++; values.set(key, value) } }
}

describe('completed synthetic commercial history', () => {
  it('adds exactly five delivered orders with unique aggregate and event IDs', () => {
    const data = createInitialScenario()
    expect(historicalOrders(data)).toHaveLength(5)
    expect(data.orders).toHaveLength(13)
    expect(historicalOrders(data).every((o) => o.status === 'delivered')).toBe(true)
    const ids = Object.values(data).flat().map((row) => row.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(validateDomainData(data)).toEqual(data)
  })

  it.each(historicalOrders(createInitialScenario()))('links $id to valid parties, product, offer and harvested lot', (order) => {
    const data = createInitialScenario()
    expect(data.organizations.find((o) => o.id === order.producerOrganizationId)).toMatchObject({ type: 'producer', active: true })
    expect(data.organizations.find((o) => o.id === order.buyerOrganizationId)).toMatchObject({ type: 'buyer', active: true })
    const offer = data.offers.find((o) => o.id === order.offerId)!
    const production = data.productions.find((p) => p.id === offer.productionId)!
    expect(offer).toMatchObject({ producerOrganizationId: order.producerOrganizationId, status: 'closed', pricePerKg: order.unitPrice })
    expect(production).toMatchObject({ producerOrganizationId: order.producerOrganizationId, status: 'finished', harvestedQuantityKg: order.quantityKg })
    expect(data.products.find((p) => p.id === production.productId)?.id).toBe(order.producerOrganizationId === 'boa-esperanca' ? 'batata' : 'tomate')
    expect(offer.quantityKg).toBe(order.quantityKg)
    expect(order.totalAmount).toBe(orderTotal(order.quantityKg, order.unitPrice))
  })

  it.each(historicalOrders(createInitialScenario()))('keeps chronological commercial and completed logistics events for $id', (order) => {
    const data = createInitialScenario()
    const events = data.domainEvents.filter((e) => e.aggregateType === 'order' && e.aggregateId === order.id)
    expect(events.map((e) => e.eventType)).toEqual(['order_requested', 'order_confirmed', 'order_preparing', 'transport_requested', 'order_dispatched', 'order_delivered'])
    expect(events[0].timestamp).toBe(order.requestedAt)
    expect(events.at(-1)?.timestamp).toBe(order.updatedAt)
    for (let i = 0; i < events.length; i++) {
      expect(events[i].metadata.synthetic).toBe(true)
      expect(events[i].timestamp <= now).toBe(true)
      if (i > 0) expect(events[i].timestamp > events[i - 1].timestamp).toBe(true)
    }
    const operation = data.logistics.filter((l) => l.orderIds.includes(order.id))
    expect(operation).toHaveLength(1)
    expect(operation[0]).toMatchObject({ status: 'delivered', totalLoadKg: order.quantityKg, updatedAt: order.updatedAt })
    expect(data.domainEvents.filter((e) => e.aggregateId === operation[0].id).map((e) => e.eventType)).toEqual(['logistics_created', 'logistics_transport_requested', 'logistics_dispatched', 'logistics_delivered'])
    const offer = data.offers.find((o) => o.id === order.offerId)!
    expect(offer.createdAt < order.requestedAt).toBe(true)
    expect(offer.availableFrom <= order.requestedAt.slice(0, 10)).toBe(true)
    expect(() => validateOrderHistory(data)).not.toThrow()
  })

  it('spreads deliveries over five dates in the last 30 days and supports another reference', () => {
    const data = createInitialScenario()
    expect(historicalOrders(data).map((o) => o.updatedAt.slice(0, 10))).toEqual(['2026-10-13', '2026-10-20', '2026-10-26', '2026-10-31', '2026-11-04'])
    const futureReference = '2027-02-01T00:00:00.000Z'
    const shifted = createInitialScenario(futureReference)
    expect(validateDomainData(shifted)).toEqual(shifted)
    expect(historicalOrders(shifted).map((o) => o.updatedAt.slice(0, 10))).toEqual(['2027-01-07', '2027-01-14', '2027-01-20', '2027-01-25', '2027-01-29'])
    expect(shifted.orders.filter((o) => !o.id.startsWith('history-'))).toEqual(previousScenario().orders)
  })

  it('consumes each historical lot once without changing current stock or catalog', () => {
    const data = createInitialScenario(), previous = previousScenario()
    for (const order of historicalOrders(data)) {
      const offer = data.offers.find((o) => o.id === order.offerId)!
      expect(committedQuantity(data, offer.id)).toBe(order.quantityKg)
      expect(availableQuantity(data, offer)).toBe(0)
      expect(allocatedProductionQuantity(data, offer.productionId)).toBe(order.quantityKg)
    }
    for (const offer of previous.offers) {
      expect(availableQuantity(data, offer)).toBe(availableQuantity(previous, offer))
      expect(committedQuantity(data, offer.id)).toBe(committedQuantity(previous, offer.id))
    }
    for (const producer of ['santa-clara', 'boa-esperanca', 'horizonte']) expect(availableProductionKg(data, producer)).toBe(availableProductionKg(previous, producer))
    expect(availableCatalog(data)).toEqual(availableCatalog(previous))
    expect(data.logistics.filter((l) => l.status !== 'delivered')).toEqual(previous.logistics.filter((l) => l.status !== 'delivered'))
  })

  it('preserves all eight original orders and their commercial history', () => {
    const data = createInitialScenario()
    const original = data.orders.filter((o) => !o.id.startsWith('history-'))
    expect(original).toEqual([
      ['order-pending', 'offer-tomate', 'santa-clara', 'bom-preco', 200, 4.5, 'pending_confirmation'],
      ['order-confirmed', 'offer-tomate', 'santa-clara', 'restaurante-central', 100, 4.5, 'confirmed'],
      ['order-preparing', 'offer-tomate', 'santa-clara', 'hortifruti-regional', 150, 4.5, 'preparing'],
      ['order-transit', 'offer-batata', 'boa-esperanca', 'bom-preco', 300, 3.2, 'in_transit'],
      ['order-delivered', 'offer-milho-closed', 'horizonte', 'hortifruti-regional', 800, 1.1, 'delivered'],
      ['order-rejected', 'offer-tomate', 'santa-clara', 'bom-preco', 50, 4.5, 'rejected'],
      ['order-cancelled', 'offer-batata', 'boa-esperanca', 'restaurante-central', 60, 3.2, 'cancelled'],
      ['order-future', 'offer-milho-future', 'santa-clara', 'bom-preco', 400, 1.2, 'pending_confirmation'],
    ].map(([id, offerId, producerOrganizationId, buyerOrganizationId, quantityKg, unitPrice, status]) => ({ id, offerId, producerOrganizationId, buyerOrganizationId, quantityKg, unitPrice, totalAmount: orderTotal(Number(quantityKg), Number(unitPrice)), status, requestedAt: '2026-11-02T08:00:00.000Z', updatedAt: '2026-11-04T16:00:00.000Z' })))
    expect(() => validateOrderHistory(previousScenario())).not.toThrow()
  })
})

describe('dashboard projections from synthetic orders', () => {
  const data = createInitialScenario()
  const service = new DashboardService({ snapshot: async () => structuredClone(data) }, { now: () => now })

  it.each([
    ['santa-clara', 2250, 4], ['bom-preco', 2370, 4], ['boa-esperanca', 480, 1],
    ['restaurante-central', 360, 1], ['horizonte', 880, 1], ['hortifruti-regional', 880, 1],
  ] as const)('isolates completed indicators and recent orders for %s', async (organizationId, amount, count) => {
    const overview = await service.overview(organizationId, 30)
    expect(overview.indicators).toMatchObject({ completedAmount: amount, completedCount: count })
    expect(overview.recentOrders.every((o) => overview.profile === 'producer' ? o.producerOrganizationId === organizationId : o.buyerOrganizationId === organizationId)).toBe(true)
    expect(overview.recentOrders.length).toBeLessThanOrEqual(5)
    expect(overview.series.totalAmount).toBe(amount)
  })

  it.each([7, 30, 90] as const)('derives matching producer/buyer amounts for the same transactions in %s days', async (period) => {
    const producer = await service.overview('santa-clara', period)
    const buyer = await service.overview('bom-preco', period)
    expect(producer.series).toMatchObject({ totalAmount: period === 7 ? 450 : 2250, orderCount: period === 7 ? 1 : 4, missingDeliveryDate: 0 })
    expect(buyer.series).toMatchObject({ totalAmount: period === 7 ? 450 : 2370, orderCount: period === 7 ? 1 : 4, missingDeliveryDate: 0 })
    const shared = historicalOrders(data).filter((o) => o.producerOrganizationId === 'santa-clara' && o.buyerOrganizationId === 'bom-preco')
    for (const order of shared) {
      const producerPoint = producer.series.points.find((p) => p.date === order.updatedAt.slice(0, 10))
      const buyerPoint = buyer.series.points.find((p) => p.date === order.updatedAt.slice(0, 10))
      if (producerPoint) {
        expect(producerPoint.amount).toBe(order.totalAmount)
        expect(buyerPoint).toEqual(producerPoint)
      }
    }
  })

  it('exposes only the current buyers completed supplier transactions', () => {
    const suppliers = supplierDirectory(data, 'bom-preco')
    expect(suppliers.find((s) => s.id === 'santa-clara')).toMatchObject({ completedAmount: 1890, completedCount: 3 })
    expect(suppliers.find((s) => s.id === 'boa-esperanca')).toMatchObject({ completedAmount: 480, completedCount: 1 })
    expect(suppliers.flatMap((s) => s.completedOrders).every((o) => o.buyerOrganizationId === 'bom-preco')).toBe(true)
    expect(suppliers.flatMap((s) => s.completedOrders).some((o) => o.id === 'history-order-03')).toBe(false)
    expect(supplierDirectory(data, 'restaurante-central').find((s) => s.id === 'santa-clara')).toMatchObject({ completedAmount: 360, completedCount: 1 })
  })
})

describe('initial scenario persistence', () => {
  it('initializes a new browser with the enriched scenario and never duplicates it on reload', async () => {
    const storage = memoryStorage(), db = new LocalDomainDatabase(storage)
    expect(await db.initialize()).toBe('created')
    expect(await db.snapshot()).toEqual(createInitialScenario())
    const raw = storage.getItem(DOMAIN_STORAGE_KEY), writes = storage.writes
    const reloaded = new LocalDomainDatabase(storage)
    expect(await reloaded.initialize()).toBe('loaded')
    expect(historicalOrders(await reloaded.snapshot())).toHaveLength(5)
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(raw)
    expect(storage.writes).toBe(writes)
    expect(JSON.parse(raw!).schemaVersion).toBe(DOMAIN_SCHEMA_VERSION)
  })

  it('preserves a previous browser and QA carrot order, logistics, favorites, events and receipts byte for byte', async () => {
    const storage = memoryStorage()
    storage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify({ schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: now, data: previousScenario() }))
    const db = new LocalDomainDatabase(storage)
    expect(await db.initialize()).toBe('loaded')
    let sequence = 0
    const environment = { now: () => now, id: () => `qa-${++sequence}` }
    const commercial = new CommercialService(db, environment)
    const production = await commercial.createProduction('santa-clara', { productId: 'cenoura', estimatedQuantityKg: 500, harvestedQuantityKg: 500, expectedHarvestDate: '2026-11-01', status: 'harvested' })
    const offer = await commercial.createOffer('santa-clara', { productionId: production.id, quantityKg: 500, pricePerKg: 2.8, availabilityType: 'immediate', availableFrom: '2026-11-01' })
    await commercial.publishOffer('santa-clara', offer.id)
    const order = await commercial.requestOrder('bom-preco', { offerId: offer.id, quantityKg: 200, idempotencyKey: 'qa-cenoura' })
    await commercial.confirmOrder('santa-clara', order.id)
    await commercial.prepareOrder('santa-clara', order.id)
    await new LogisticsService(db, environment).createOperation('santa-clara', { partnerOrganizationId: 'rotas-do-campo', orderIds: [order.id], transportMode: 'individual', vehicleCapacityKg: 1000, estimatedCost: 120 })
    storage.setItem(SUPPLIER_FAVORITES_KEY, JSON.stringify({ version: 1, buyers: { 'bom-preco': ['santa-clara'] } }))
    storage.setItem('safraviva-workspace', 'qa-workspace')
    const before = await db.snapshot(), bytes = new Map(storage.values), writes = storage.writes
    const reloaded = new LocalDomainDatabase(storage)
    expect(await reloaded.initialize()).toBe('loaded')
    expect(await reloaded.snapshot()).toEqual(before)
    expect(storage.values).toEqual(bytes)
    expect(storage.writes).toBe(writes)
    expect(historicalOrders(await reloaded.snapshot())).toHaveLength(0)
    expect((await reloaded.snapshot()).orders.find((o) => o.id === order.id)).toMatchObject({ quantityKg: 200, totalAmount: 560, status: 'preparing' })
  })
})
