import { beforeEach, describe, expect, it } from 'vitest'
import { LogisticsService } from './logistics-service'
import { CommercialService } from './commercial-service'
import { LocalDomainDatabase, DOMAIN_SCHEMA_VERSION, DOMAIN_STORAGE_KEY } from '@/repositories/local/domain-database'
import { createInitialScenario } from '@/data/commercial-scenario'
import { DomainQueryService } from './query-service'
import type { DeliveryInformation } from '@/types/logistics'
let db: LocalDomainDatabase
let service: LogisticsService
let storage: Map<string, string>
let sequence = 0
const env = { now: () => '2026-11-06T12:00:00.000Z', id: () => `logistics-test-${++sequence}` }
const ownIds = ['reference-4a-order-0', 'reference-4a-order-3']
beforeEach(async () => {
  sequence = 0; storage = new Map()
  db = new LocalDomainDatabase({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { storage.set(key, value) } })
  await db.initialize(); service = new LogisticsService(db, env)
})
async function demo() { await service.importReferenceScenario('santa-clara', { confirmed: true }) }
async function delivery(): Promise<DeliveryInformation> { await demo(); return (await db.snapshot()).orders.find((o) => o.id === ownIds[0])!.delivery! }
describe('logistics planning commands', () => {
  it('requires an explicit additive reference import and preserves existing records', async () => {
    const before = await db.snapshot()
    await expect(service.importReferenceScenario('santa-clara', { confirmed: false })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' })
    await demo()
    const after = await db.snapshot()
    expect(after.orders.slice(0, before.orders.length)).toEqual(before.orders)
    expect(after.productions.slice(0, before.productions.length)).toEqual(before.productions)
    expect(after.orders.length).toBe(before.orders.length + 4)
    await demo(); expect((await db.snapshot()).orders).toEqual(after.orders)
  })
  it('isolates pending deliveries and lists cross-producer suggestions', async () => {
    await demo(); const workspace = await service.planningWorkspace('santa-clara')
    expect(workspace.pending.map((o) => o.id).sort()).toEqual(ownIds.sort())
    expect(workspace.opportunities.some((o) => o.producerIds.includes('horizonte'))).toBe(true)
    await expect(service.planningWorkspace('bom-preco')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('saves delivery details and audit without changing financial data', async () => {
    const input = await delivery(); const commercial = new CommercialService(db, env)
    await commercial.confirmOrder('santa-clara', 'order-pending')
    await service.saveDelivery('santa-clara', 'order-pending', input)
    const order = (await db.snapshot()).orders.find((o) => o.id === 'order-pending')!
    expect(order).toMatchObject({ unitPrice: 4.5, totalAmount: 900, quantityKg: 200, delivery: input })
    expect((await new DomainQueryService(db).orderHistory(order.id)).at(-1)?.eventType).toBe('order_delivery_updated')
  })
  it('denies delivery edits of another producer and validates weight', async () => {
    const input = await delivery()
    await expect(service.saveDelivery('boa-esperanca', ownIds[0], input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.saveDelivery('santa-clara', ownIds[0], { ...input, weightKg: 201 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('requires individual authority for foreign loads even when recommendation is compatible', async () => {
    await demo()
    const suggestion = (await service.planningWorkspace('santa-clara')).opportunities[0]
    expect(suggestion.requiresOtherProducers).toBe(true)
    const before = await db.snapshot()
    await expect(service.organizeTransport('santa-clara', { orderIds: suggestion.orderIds, partnerId: suggestion.partnerId, mode: 'shared' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await db.snapshot()).toEqual(before)
  })
  it('atomically registers a manually confirmed shared transport and preserves commercial status', async () => {
    await demo(); const operation = await service.organizeTransport('santa-clara', { orderIds: ownIds, partnerId: 'rotas-do-campo', mode: 'shared' })
    expect(operation).toMatchObject({ status: 'transport_requested', totalLoadKg: 300, orderIds: ownIds })
    const data = await db.snapshot()
    expect(data.orders.find((o) => o.id === ownIds[0])?.status).toBe('confirmed')
    expect(data.domainEvents.filter((e) => e.aggregateId === operation.id).map((e) => e.eventType)).toEqual(['logistics_created', 'logistics_transport_requested'])
    expect((await service.planningWorkspace('santa-clara')).pending).toHaveLength(0)
  })
  it('prevents duplicate transport under repeated concurrent submissions', async () => {
    await demo(); const input = { orderIds: ownIds, partnerId: 'rotas-do-campo', mode: 'shared' as const }
    const results = await Promise.allSettled([service.organizeTransport('santa-clara', input), service.organizeTransport('santa-clara', input)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect((await db.snapshot()).logistics.filter((op) => op.orderIds.includes(ownIds[0]))).toHaveLength(1)
  })
  it('advances a requested operation only through valid authorized service actions', async () => {
    await demo(); const operation = await service.organizeTransport('santa-clara', { orderIds: ownIds, partnerId: 'rotas-do-campo', mode: 'shared' })
    await expect(service.dispatch('santa-clara', operation.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.dispatch('rotas-do-campo', operation.id)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' })
    const commercial = new CommercialService(db, env)
    for (const id of ownIds) await commercial.prepareOrder('santa-clara', id)
    await service.dispatch('rotas-do-campo', operation.id)
    expect((await db.snapshot()).orders.find((o) => o.id === ownIds[0])?.status).toBe('in_transit')
    await service.deliver('rotas-do-campo', operation.id)
    expect((await db.snapshot()).orders.find((o) => o.id === ownIds[0])?.status).toBe('delivered')
    expect((await service.planningWorkspace('santa-clara')).operations.find((op) => op.id === operation.id)?.history.at(-1)?.eventType).toBe('logistics_delivered')
  })
  it('rejects a stale price estimate instead of silently replacing it', async () => {
    await demo(); const quote = await service.quoteTransport('santa-clara', ownIds, 'rotas-do-campo', 'shared')
    await db.transaction((data) => { data.orders.find((o) => o.id === ownIds[0])!.delivery!.referenceDistanceKm = 100 })
    await expect(service.organizeTransport('santa-clara', { orderIds: ownIds, partnerId: 'rotas-do-campo', mode: 'shared', expectedQuote: quote })).rejects.toMatchObject({ code: 'CONFLICT' })
  })
  it('persists delivery and exposes it through orders integration', async () => {
    await demo(); const orders = await new DomainQueryService(db).ordersWorkspace('bom-preco')
    expect(orders.find((o) => o.id === ownIds[0])?.delivery?.destination.label).toContain('sintético')
    const port = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => { storage.set(key, value) } }
    const reloaded = new LocalDomainDatabase(port)
    expect(await reloaded.initialize()).toBe('loaded'); expect(await reloaded.snapshot()).toEqual(await db.snapshot())
  })
  it('prevents changes to delivery after transport is requested', async () => {
    const input = await delivery(); await service.organizeTransport('santa-clara', { orderIds: [ownIds[0]], partnerId: 'rotas-do-campo', mode: 'individual' })
    await expect(service.saveDelivery('santa-clara', ownIds[0], input)).rejects.toMatchObject({ code: 'CONFLICT' })
  })
})
describe('versioned migration', () => {
  it('migrates schema v1 additively and backs up exact original bytes', async () => {
    const data = createInitialScenario(); for (const org of data.organizations) delete org.logisticsProfile
    const raw = JSON.stringify({ schemaVersion: 1, initializedAt: env.now(), data })
    storage.set(DOMAIN_STORAGE_KEY, raw)
    expect(await db.initialize()).toBe('migrated')
    const migrated = await db.snapshot()
    expect(migrated.orders).toEqual(data.orders); expect(migrated.offers).toEqual(data.offers); expect(migrated.domainEvents).toEqual(data.domainEvents)
    expect(migrated.organizations.find((o) => o.id === 'rotas-do-campo')?.logisticsProfile?.source).toBe('synthetic')
    expect(storage.get(`${DOMAIN_STORAGE_KEY}.migration-v1`)).toBe(raw)
    expect(JSON.parse(storage.get(DOMAIN_STORAGE_KEY)!).schemaVersion).toBe(DOMAIN_SCHEMA_VERSION)
    expect(await db.initialize()).toBe('loaded')
  })
  it('preserves custom profiles and requires no guessed delivery addresses', async () => {
    const data = createInitialScenario()
    data.organizations.find((o) => o.id === 'rotas-do-campo')!.logisticsProfile!.capacityKg = 987
    storage.set(DOMAIN_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, initializedAt: env.now(), data }))
    await db.initialize()
    const migrated = await db.snapshot()
    expect(migrated.organizations.find((o) => o.id === 'rotas-do-campo')?.logisticsProfile?.capacityKg).toBe(987)
    expect(migrated.orders.every((o) => o.delivery === undefined)).toBe(true)
  })
  it('preserves original data when migration write fails and can retry safely', async () => {
    const raw = JSON.stringify({ schemaVersion: 1, initializedAt: env.now(), data: createInitialScenario() })
    storage.set(DOMAIN_STORAGE_KEY, raw)
    let fail = true
    const database = new LocalDomainDatabase({ getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => { if (fail && key === DOMAIN_STORAGE_KEY) throw new Error('Quota exceeded'); storage.set(key, value) } })
    await expect(database.initialize()).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
    expect(storage.get(DOMAIN_STORAGE_KEY)).toBe(raw)
    expect(storage.get(`${DOMAIN_STORAGE_KEY}.migration-v1`)).toBe(raw)
    fail = false; expect(await database.initialize()).toBe('migrated')
    expect(storage.get(`${DOMAIN_STORAGE_KEY}.migration-v1`)).toBe(raw)
  })
  it('never replaces a legacy scenario on failed migration', async () => {
    const raw = JSON.stringify({ schemaVersion: 1, initializedAt: env.now(), data: {} })
    storage.set(DOMAIN_STORAGE_KEY, raw)
    await expect(db.initialize()).rejects.toMatchObject({ code: 'INCOMPATIBLE_SCHEMA' })
    expect(storage.get(DOMAIN_STORAGE_KEY)).toBe(raw)
  })
})
