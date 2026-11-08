import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { allocatedProductionQuantity, availableQuantity, commercialTotals, committedQuantity } from '@/domain/calculations'
import { validateDomainData } from '@/domain/integrity'
import { DOMAIN_SCHEMA_VERSION, DOMAIN_STORAGE_KEY, LocalDomainDatabase } from '@/repositories/local/domain-database'
import { createLocalDomainRepositories } from '@/repositories/local/domain-repositories'
import type { StoragePort } from '@/repositories/contracts/domain-repositories'
import { CommercialService } from '@/services/domain/commercial-service'
import { LogisticsService } from '@/services/domain/logistics-service'
import { DomainQueryService } from '@/services/domain/query-service'
import type { DomainData } from '@/types/domain'

class MemoryStorage implements StoragePort {
  values = new Map<string, string>()
  failWrites = false
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('Quota exceeded')
    this.values.set(key, value)
  }
}
let storage: MemoryStorage
let database: LocalDomainDatabase
let service: CommercialService
let logistics: LogisticsService
let queries: DomainQueryService
let sequence = 0
const env = { now: () => '2026-11-06T12:00:00.000Z', id: () => `test-${++sequence}` }
const productionInput = { productId: 'tomate', estimatedQuantityKg: 1000, harvestedQuantityKg: 1000, expectedHarvestDate: '2026-11-01', status: 'harvested' as const }
beforeEach(async () => {
  sequence = 0
  storage = new MemoryStorage()
  database = new LocalDomainDatabase(storage)
  await database.initialize()
  service = new CommercialService(database, env)
  logistics = new LogisticsService(database, env)
  queries = new DomainQueryService(database)
})
async function offer(quantityKg = 1000) {
  const production = await service.createProduction('santa-clara', productionInput)
  const created = await service.createOffer('santa-clara', { productionId: production.id, quantityKg, pricePerKg: 4.5, availabilityType: 'immediate', availableFrom: '2026-11-01' })
  return service.publishOffer('santa-clara', created.id)
}
async function request(offerId: string, quantityKg = 100, key = `key-${++sequence}`) {
  return service.requestOrder('bom-preco', { offerId, quantityKg, idempotencyKey: key })
}
async function confirmed(quantityKg = 100) {
  const published = await offer()
  const order = await request(published.id, quantityKg)
  return service.confirmOrder('santa-clara', order.id)
}
async function operation() {
  const order = await confirmed()
  await service.prepareOrder('santa-clara', order.id)
  const transport = await logistics.createOperation('santa-clara', { partnerOrganizationId: 'rotas-do-campo', orderIds: [order.id], transportMode: 'individual', vehicleCapacityKg: 1000, estimatedCost: 100 })
  return { order, transport }
}
async function saldo(id: string) {
  const data = await database.snapshot()
  return availableQuantity(data, data.offers.find((row) => row.id === id)!)
}

describe('productions and offers', () => {
  it('creates a valid production and its event', async () => {
    const created = await service.createProduction('santa-clara', productionInput)
    expect(created.producerOrganizationId).toBe('santa-clara')
    expect((await database.snapshot()).domainEvents.at(-1)).toMatchObject({ aggregateId: created.id, eventType: 'production_created' })
  })
  it.each([-1, 0, NaN, Infinity, 0.0001])('rejects invalid quantity %s', async (estimatedQuantityKg) => {
    await expect(service.createProduction('santa-clara', { ...productionInput, estimatedQuantityKg })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('rejects negative harvested volume and missing products', async () => {
    await expect(service.createProduction('santa-clara', { ...productionInput, harvestedQuantityKg: -1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.createProduction('santa-clara', { ...productionInput, productId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('links an offer to its production and publishes it', async () => {
    const published = await offer()
    expect(published.status).toBe('published')
    const data = await database.snapshot()
    expect(data.productions.find((row) => row.id === published.productionId)?.producerOrganizationId).toBe(published.producerOrganizationId)
    expect(data.domainEvents.filter((event) => event.aggregateId === published.id).map((event) => event.eventType)).toEqual(['offer_created', 'offer_published'])
  })
  it('limits the sum of draft, published and paused offers to commercial volume', async () => {
    const published = await offer(600)
    await service.pauseOffer('santa-clara', published.id)
    const input = { productionId: published.productionId, quantityKg: 401, pricePerKg: 1, availabilityType: 'immediate' as const, availableFrom: '2026-11-01' }
    await expect(service.createOffer('santa-clara', input)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    const second = await service.createOffer('santa-clara', { ...input, quantityKg: 400 })
    expect(second.status).toBe('draft')
  })
  it('prevents offers on finished or foreign productions', async () => {
    const input = { productionId: 'prod-milho-hz', quantityKg: 10, pricePerKg: 1, availabilityType: 'immediate' as const, availableFrom: '2026-11-01' }
    await expect(service.createOffer('horizonte', input)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await expect(service.createOffer('santa-clara', { ...input, productionId: 'prod-batata-be' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('prevents negative prices, unknown productions and immediate offers on growing production', async () => {
    const input = { productionId: 'prod-milho-sc', quantityKg: 10, pricePerKg: 1, availabilityType: 'immediate' as const, availableFrom: '2026-11-01' }
    await expect(service.createOffer('santa-clara', input)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.createOffer('santa-clara', { ...input, pricePerKg: -1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.createOffer('santa-clara', { ...input, productionId: 'missing' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('prevents reducing offers below committed volume or exceeding production', async () => {
    const order = await confirmed(600)
    await expect(service.editOffer('santa-clara', order.offerId, { quantityKg: 599 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    await expect(service.editOffer('santa-clara', order.offerId, { quantityKg: 1001 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect(await saldo(order.offerId)).toBe(400)
  })
  it('closing releases only unsold volume, preserving delivered/committed quantities', async () => {
    const order = await confirmed(600)
    await service.closeOffer('santa-clara', order.offerId)
    const data = await database.snapshot()
    const old = data.offers.find((row) => row.id === order.offerId)!
    expect(allocatedProductionQuantity(data, old.productionId)).toBe(600)
    await service.createOffer('santa-clara', { productionId: old.productionId, quantityKg: 400, pricePerKg: 2, availabilityType: 'immediate', availableFrom: '2026-11-01' })
    await expect(service.publishOffer('santa-clara', old.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
  it('protects reservations when actual harvest is below planned offers', async () => {
    await expect(service.updateProduction('santa-clara', 'prod-milho-sc', { status: 'harvested', harvestedQuantityKg: 100 })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    expect((await database.snapshot()).productions.find((row) => row.id === 'prod-milho-sc')?.status).toBe('growing')
  })
})

describe('commercial orders', () => {
  it('requests a purchase without reserving volume', async () => {
    const published = await offer()
    const order = await request(published.id, 700)
    expect(order).toMatchObject({ status: 'pending_confirmation', unitPrice: 4.5, totalAmount: 3150 })
    expect(await saldo(published.id)).toBe(1000)
    expect(committedQuantity(await database.snapshot(), published.id)).toBe(0)
  })
  it('confirms and reserves atomically', async () => {
    const order = await confirmed(700)
    expect(order.status).toBe('confirmed')
    expect(await saldo(order.offerId)).toBe(300)
  })
  it('revalidates balance at confirmation, allowing competing pending requests', async () => {
    const published = await offer()
    const first = await request(published.id, 700)
    const second = await request(published.id, 700)
    const results = await Promise.allSettled([service.confirmOrder('santa-clara', first.id), service.confirmOrder('santa-clara', second.id)])
    expect(results.map((row) => row.status)).toEqual(['fulfilled', 'rejected'])
    expect(await saldo(published.id)).toBe(300)
    expect((await queries.orderHistory(second.id)).map((event) => event.eventType)).toEqual(['order_requested'])
  })
  it('rejects pending orders without reserving inventory', async () => {
    const published = await offer()
    const order = await request(published.id)
    expect((await service.rejectOrder('santa-clara', order.id)).status).toBe('rejected')
    expect(await saldo(published.id)).toBe(1000)
  })
  it('cancels pending orders directly as buyer', async () => {
    const order = await request((await offer()).id)
    expect((await service.requestCancellation('bom-preco', order.id)).status).toBe('cancelled')
  })
  it('keeps reservation until producer approval then releases it', async () => {
    const order = await confirmed(700)
    expect((await service.requestCancellation('bom-preco', order.id)).status).toBe('confirmed')
    expect(await saldo(order.offerId)).toBe(300)
    expect((await service.approveCancellation('santa-clara', order.id)).status).toBe('cancelled')
    expect(await saldo(order.offerId)).toBe(1000)
  })
  it('requires a cancellation request and forbids foreign approval', async () => {
    const order = await confirmed()
    await expect(service.approveCancellation('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await service.requestCancellation('bom-preco', order.id)
    await expect(service.approveCancellation('boa-esperanca', order.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('prevents cancellation after transport starts', async () => {
    const { order, transport } = await operation()
    await service.requestCancellation('bom-preco', order.id)
    await logistics.requestTransport('santa-clara', transport.id)
    await logistics.dispatch('rotas-do-campo', transport.id)
    await expect(service.requestCancellation('bom-preco', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await expect(service.approveCancellation('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await logistics.deliver('rotas-do-campo', transport.id)
    await expect(service.requestCancellation('bom-preco', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    expect(committedQuantity(await database.snapshot(), order.offerId)).toBe(100)
  })
  it('preserves the requested price when the offer price changes', async () => {
    const published = await offer()
    const order = await request(published.id)
    await service.editOffer('santa-clara', published.id, { pricePerKg: 8 })
    expect((await service.confirmOrder('santa-clara', order.id)).totalAmount).toBe(450)
  })
  it('deduplicates simultaneous execution and persisted retries', async () => {
    const published = await offer()
    const orders = await Promise.all([request(published.id, 100, 'same-command'), request(published.id, 100, 'same-command')])
    expect(orders[0].id).toBe(orders[1].id)
    const reloaded = new CommercialService(new LocalDomainDatabase(storage), env)
    expect((await reloaded.requestOrder('bom-preco', { offerId: published.id, quantityKg: 100, idempotencyKey: 'same-command' })).id).toBe(orders[0].id)
    expect((await queries.orderHistory(orders[0].id))).toHaveLength(1)
    await expect(request(published.id, 200, 'same-command')).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('does not expose fully committed, paused, draft or closed offers', async () => {
    const order = await confirmed(1000)
    expect((await queries.availableOffers()).some((row) => row.id === order.offerId)).toBe(false)
    await expect(request(order.offerId, 1)).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
    const published = await offer()
    await service.pauseOffer('santa-clara', published.id)
    await expect(request(published.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await expect(request('offer-tomate-draft')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await expect(request('offer-milho-closed')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
  it('blocks invalid status transitions and confirmation of paused offers', async () => {
    const published = await offer()
    const order = await request(published.id)
    await expect(service.prepareOrder('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await service.pauseOffer('santa-clara', published.id)
    await expect(service.confirmOrder('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await service.publishOffer('santa-clara', published.id)
    await service.confirmOrder('santa-clara', order.id)
    await expect(service.confirmOrder('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await expect(service.rejectOrder('santa-clara', order.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
  it('does not prepare future production before harvest', async () => {
    await service.confirmOrder('santa-clara', 'order-future')
    await expect(service.prepareOrder('santa-clara', 'order-future')).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
  it('derives commercial totals from committed orders only', async () => {
    const orders = (await database.snapshot()).orders
    expect(commercialTotals(orders)).toEqual({ quantityKg: 2000, totalAmount: 5695 })
  })
})

describe('authorization and integrity', () => {
  it('requires compatible active organizations', async () => {
    await expect(service.createProduction('bom-preco', productionInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.createProduction('missing', productionInput)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.requestOrder('santa-clara', { offerId: 'offer-batata', quantityKg: 10, idempotencyKey: 'invalid' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await database.transaction((data) => { data.organizations.find((row) => row.id === 'bom-preco')!.active = false })
    await expect(request('offer-tomate')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('blocks buyer creation of offers and foreign commercial operations', async () => {
    await expect(service.createOffer('bom-preco', { productionId: 'prod-tomate-sc', quantityKg: 1, pricePerKg: 1, availabilityType: 'immediate', availableFrom: '2026-11-01' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.confirmOrder('boa-esperanca', 'order-pending')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.requestCancellation('restaurante-central', 'order-pending')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('validates all references and seeded historical timelines', () => {
    const initial = validateDomainData(createInitialScenario())
    expect(initial.organizations).toHaveLength(8)
    expect(initial.users.find((row) => row.id === 'joao-oliveira')?.name).toBe('João Oliveira')
    expect(initial.users.find((row) => row.id === 'mariana-costa')?.name).toBe('Mariana Costa')
    for (const order of initial.orders) {
      const history = initial.domainEvents.filter((event) => event.aggregateType === 'order' && event.aggregateId === order.id)
      let status: unknown = null
      for (const event of history) { expect(event.metadata.fromStatus).toBe(status); status = event.metadata.toStatus }
      expect(status).toBe(order.status)
    }
    expect(initial.marketAnalyses.every((row) => row.methodology.includes('sintético'))).toBe(true)
  })
  it.each([
    (d: DomainData) => { d.offers[0].productionId = 'missing' },
    (d: DomainData) => { d.orders[0].buyerOrganizationId = 'santa-clara' },
    (d: DomainData) => { d.orders[0].totalAmount = 0 },
    (d: DomainData) => { d.domainEvents[0].aggregateId = 'missing' },
    (d: DomainData) => { d.logistics[0].totalLoadKg = 1 },
    (d: DomainData) => { d.organizations.push(d.organizations[0]) },
  ])('rejects corrupt relational data (%#)', (corrupt) => {
    const initial = createInitialScenario(); corrupt(initial)
    expect(() => validateDomainData(initial)).toThrow()
  })
  it('returns typed missing-record errors and detached copies', async () => {
    const repositories = createLocalDomainRepositories(database)
    expect(await repositories.products.findById('missing')).toBe(null)
    await expect(repositories.orders.getById('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const first = await repositories.products.getById('tomate'); first.name = 'Mutation'
    expect((await repositories.products.getById('tomate')).name).toBe('Tomate')
  })
})

describe('logistics and operational history', () => {
  it('records an entire commercial and logistics timeline atomically', async () => {
    const { order, transport } = await operation()
    await logistics.requestTransport('santa-clara', transport.id)
    await logistics.dispatch('rotas-do-campo', transport.id)
    await logistics.deliver('rotas-do-campo', transport.id)
    const history = await queries.orderHistory(order.id)
    expect(history.map((event) => event.eventType)).toEqual(['order_requested', 'order_confirmed', 'order_preparing', 'transport_requested', 'order_dispatched', 'order_delivered'])
    expect(history.every((event) => event.metadata.actorOrganizationId && event.timestamp && event.aggregateId === order.id)).toBe(true)
    expect((await database.snapshot()).orders.find((row) => row.id === order.id)?.status).toBe('delivered')
  })
  it('rejects overload, repeated assignments and incompatible partners', async () => {
    const order = await confirmed(500)
    const input = { partnerOrganizationId: 'rotas-do-campo', orderIds: [order.id], transportMode: 'individual' as const, vehicleCapacityKg: 400, estimatedCost: 100 }
    await expect(logistics.createOperation('santa-clara', input)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(logistics.createOperation('santa-clara', { ...input, vehicleCapacityKg: 1000, partnerOrganizationId: 'bom-preco' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await logistics.createOperation('santa-clara', { ...input, vehicleCapacityKg: 1000 })
    await expect(logistics.createOperation('santa-clara', { ...input, vehicleCapacityKg: 1000 })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('blocks invalid dispatches and unauthorized partners', async () => {
    const { transport } = await operation()
    await expect(logistics.dispatch('rotas-do-campo', transport.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    await logistics.requestTransport('santa-clara', transport.id)
    await expect(logistics.dispatch('carga-verde', transport.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(logistics.deliver('rotas-do-campo', transport.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
  it('allows approved cancellation before dispatch, recalculating load', async () => {
    const { order, transport } = await operation()
    await logistics.requestTransport('santa-clara', transport.id)
    await service.requestCancellation('bom-preco', order.id)
    await service.approveCancellation('santa-clara', order.id)
    const data = await database.snapshot()
    expect(data.logistics.find((row) => row.id === transport.id)?.totalLoadKg).toBe(0)
    expect(await saldo(order.offerId)).toBe(1000)
    await expect(logistics.dispatch('rotas-do-campo', transport.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
  })
})

describe('versioned persistence and recovery', () => {
  it('loads changes after a new database instance, without reseeding', async () => {
    const created = await confirmed()
    const previous = storage.getItem(DOMAIN_STORAGE_KEY)
    const reloaded = new LocalDomainDatabase(storage)
    expect(await reloaded.initialize()).toBe('loaded')
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(previous)
    expect((await reloaded.snapshot()).orders.find((row) => row.id === created.id)?.status).toBe('confirmed')
  })
  it('requires explicit restore confirmation and preserves workspace selection', async () => {
    const workspace = JSON.stringify({ state: { activeWorkspaceId: 'bom-preco' }, version: 1 })
    storage.setItem('safraviva-workspace', workspace)
    await confirmed()
    const modified = storage.getItem(DOMAIN_STORAGE_KEY)
    await expect(database.restoreInitialScenario({ confirmed: false })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' })
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(modified)
    await database.restoreInitialScenario({ confirmed: true })
    expect(await database.snapshot()).toEqual(createInitialScenario())
    expect(storage.getItem('safraviva-workspace')).toBe(workspace)
    expect(storage.getItem(`${DOMAIN_STORAGE_KEY}.recovery`)).toBe(modified)
  })
  it.each(['not-json', 'null', JSON.stringify({ schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: 'invalid', data: {} })])('backs up malformed data before controlled recovery (%s)', async (raw) => {
    storage.setItem(DOMAIN_STORAGE_KEY, raw)
    expect(await database.initialize()).toBe('recovered')
    expect(storage.getItem(`${DOMAIN_STORAGE_KEY}.recovery`)).toBe(raw)
    expect(await database.snapshot()).toEqual(createInitialScenario())
  })
  it('does not overwrite an incompatible schema without confirmation', async () => {
    const raw = JSON.stringify({ schemaVersion: 99, data: {} })
    storage.setItem(DOMAIN_STORAGE_KEY, raw)
    await expect(database.initialize()).rejects.toMatchObject({ code: 'INCOMPATIBLE_SCHEMA' })
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(raw)
    await database.restoreInitialScenario({ confirmed: true })
    expect(await database.snapshot()).toEqual(createInitialScenario())
  })
  it('does not commit data, events or idempotency receipts on storage failure', async () => {
    const published = await offer()
    const before = storage.getItem(DOMAIN_STORAGE_KEY)
    storage.failWrites = true
    await expect(request(published.id, 50, 'retry-after-error')).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(before)
    storage.failWrites = false
    expect((await request(published.id, 50, 'retry-after-error')).status).toBe('pending_confirmation')
  })
  it('serializes commands from separate adapters sharing the same storage', async () => {
    const published = await offer()
    const first = await request(published.id, 800)
    const second = await request(published.id, 800)
    const other = new CommercialService(new LocalDomainDatabase(storage), env)
    const results = await Promise.allSettled([service.confirmOrder('santa-clara', first.id), other.confirmOrder('santa-clara', second.id)])
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    expect(await saldo(published.id)).toBe(200)
  })
})

describe('additional edge cases', () => {
  it('rejects invalid order quantities and missing offers', async () => {
    await expect(request('offer-tomate', -1)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(request('offer-tomate', 0)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(request('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
  it('handles fractional kilos and currency rounding deterministically', async () => {
    expect((await import('@/domain/calculations')).orderTotal(1.005, 1)).toBe(1.01)
    const published = await offer(0.3)
    const first = await request(published.id, 0.1)
    const second = await request(published.id, 0.2)
    await service.confirmOrder('santa-clara', first.id)
    await service.confirmOrder('santa-clara', second.id)
    expect(await saldo(published.id)).toBe(0)
  })
  it('scopes idempotency to the buyer organization', async () => {
    const published = await offer()
    const first = await request(published.id, 100, 'same-key')
    const second = await service.requestOrder('restaurante-central', { offerId: published.id, quantityKg: 100, idempotencyKey: 'same-key' })
    expect(first.id).not.toBe(second.id)
  })
  it('rolls back unknown runtime fields and nonconforming history', async () => {
    const before = storage.getItem(DOMAIN_STORAGE_KEY)
    await expect(database.transaction((data) => { data.orders[0].status = 'delivered' })).rejects.toThrow()
    await expect(database.transaction((data) => { data.domainEvents = data.domainEvents.filter((event) => event.aggregateId !== 'order-pending') })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe(before)
  })
  it('preserves already delivered volume when closing and reallocating an offer', async () => {
    const { order, transport } = await operation()
    await logistics.requestTransport('santa-clara', transport.id)
    await logistics.dispatch('rotas-do-campo', transport.id)
    await logistics.deliver('rotas-do-campo', transport.id)
    const data = await database.snapshot()
    const oldOffer = data.offers.find((row) => row.id === order.offerId)!
    await service.closeOffer('santa-clara', oldOffer.id)
    await expect(service.createOffer('santa-clara', { productionId: oldOffer.productionId, quantityKg: 901, pricePerKg: 1, availabilityType: 'immediate', availableFrom: '2026-11-01' })).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' })
  })
  it('allows a shared transport to continue with the remaining non-cancelled load', async () => {
    await service.prepareOrder('santa-clara', 'order-confirmed')
    await logistics.requestTransport('santa-clara', 'logistics-planned')
    await service.requestCancellation('restaurante-central', 'order-confirmed')
    await service.approveCancellation('santa-clara', 'order-confirmed')
    expect((await database.snapshot()).logistics.find((row) => row.id === 'logistics-planned')?.totalLoadKg).toBe(150)
    await logistics.dispatch('rotas-do-campo', 'logistics-planned')
    await logistics.deliver('rotas-do-campo', 'logistics-planned')
    const data = await database.snapshot()
    expect(data.orders.find((row) => row.id === 'order-preparing')?.status).toBe('delivered')
    expect(data.orders.find((row) => row.id === 'order-confirmed')?.status).toBe('cancelled')
  })
  it('recovers from a missing version and relationally invalid persisted data', async () => {
    storage.setItem(DOMAIN_STORAGE_KEY, '{}')
    expect(await database.initialize()).toBe('recovered')
    const invalid = createInitialScenario()
    invalid.offers[0].productionId = 'missing'
    storage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify({ schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: env.now(), data: invalid }))
    expect(await database.initialize()).toBe('recovered')
    expect(await database.snapshot()).toEqual(createInitialScenario())
  })
  it('keeps originals intact if recovery cannot persist a backup', async () => {
    storage.setItem(DOMAIN_STORAGE_KEY, 'invalid')
    storage.failWrites = true
    await expect(database.initialize()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
    expect(storage.getItem(DOMAIN_STORAGE_KEY)).toBe('invalid')
  })
})
