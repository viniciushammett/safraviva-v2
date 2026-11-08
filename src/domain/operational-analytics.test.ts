import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { availableCatalog, availableProductionKg, commercialIndicators, deliveredSeries, operationalAlerts, scopedOrders, supplierDirectory } from './operational-analytics'
const now = '2026-11-06T12:00:00.000Z'
describe('operational analytics', () => {
  it('counts only delivered money and separates pending from in-progress statuses', () => {
    const data = createInitialScenario()
    expect(commercialIndicators(data.orders)).toEqual({ completedAmount: 3610, completedCount: 6, pendingCount: 2, inProgressCount: 3 })
    expect(commercialIndicators(data.orders.filter((o) => ['rejected', 'cancelled'].includes(o.status)))).toEqual({ completedAmount: 0, completedCount: 0, pendingCount: 0, inProgressCount: 0 })
  })
  it('isolates producer and buyer scopes', () => {
    const data = createInitialScenario()
    expect(commercialIndicators(scopedOrders(data, 'santa-clara', 'producer')).completedAmount).toBe(2250)
    expect(commercialIndicators(scopedOrders(data, 'bom-preco', 'buyer'))).toMatchObject({ completedAmount: 2370, pendingCount: 2, inProgressCount: 1 })
    expect(commercialIndicators(scopedOrders(data, 'horizonte', 'producer')).completedAmount).toBe(880)
  })
  it('derives available production from commercial volume and committed orders, not advertised allocation', () => {
    const data = createInitialScenario()
    expect(availableProductionKg(data, 'santa-clara')).toBe(6550)
    expect(availableProductionKg(data, 'boa-esperanca')).toBe(1100)
    expect(availableProductionKg(data, 'horizonte')).toBe(0)
    data.orders.find((o) => o.id === 'order-pending')!.status = 'confirmed'
    expect(availableProductionKg(data, 'santa-clara')).toBe(6350)
  })
  it('keeps delivered volume consumed and ignores cancelled or rejected reservations', () => {
    const data = createInitialScenario()
    data.orders.find((o) => o.id === 'order-confirmed')!.status = 'delivered'
    expect(availableProductionKg(data, 'santa-clara')).toBe(6550)
    data.orders.find((o) => o.id === 'order-confirmed')!.status = 'cancelled'
    expect(availableProductionKg(data, 'santa-clara')).toBe(6650)
  })
  it.each([7, 30, 90])('produces %s daily buckets from actual delivery events', (days) => {
    const data = createInitialScenario()
    const series = deliveredSeries(data, data.orders, days, now)
    expect(series.points).toHaveLength(days)
    expect(series.orderCount).toBe(days === 7 ? 3 : 6)
    expect(series.totalAmount).toBe(days === 7 ? 2230 : 3610)
    expect(series.points.find((p) => p.date === '2026-11-04')?.amount).toBe(1330)
  })
  it('uses delivery date instead of order creation or updatedAt', () => {
    const data = createInitialScenario()
    data.orders = data.orders.filter((o) => o.id === 'order-delivered')
    const order = data.orders.find((o) => o.status === 'delivered')!
    order.updatedAt = now
    data.domainEvents.find((e) => e.aggregateId === order.id && e.eventType === 'order_delivered')!.timestamp = '2026-10-01T12:00:00.000Z'
    expect(deliveredSeries(data, data.orders, 7, now).totalAmount).toBe(0)
    expect(deliveredSeries(data, data.orders, 90, now).totalAmount).toBe(880)
  })
  it('treats period boundaries as inclusive UTC dates and excludes future events', () => {
    const data = createInitialScenario()
    data.orders = data.orders.filter((o) => o.id === 'order-delivered')
    const event = data.domainEvents.find((e) => e.aggregateId === 'order-delivered' && e.eventType === 'order_delivered')!
    event.timestamp = '2026-10-31T00:00:00.000Z'
    expect(deliveredSeries(data, data.orders, 7, now).totalAmount).toBe(880)
    event.timestamp = '2026-10-30T23:59:59.999Z'
    expect(deliveredSeries(data, data.orders, 7, now).totalAmount).toBe(0)
    event.timestamp = '2026-11-06T13:00:00.000Z'
    expect(deliveredSeries(data, data.orders, 7, now).totalAmount).toBe(0)
  })
  it('does not invent delivery dates when events are missing', () => {
    const data = createInitialScenario(); data.domainEvents = data.domainEvents.filter((e) => e.eventType !== 'order_delivered')
    expect(deliveredSeries(data, data.orders, 7, now)).toMatchObject({ missingDeliveryDate: 6, totalAmount: 0 })
  })
  it.each([0, 15, 31, NaN])('rejects unsupported period %s', (period) => {
    const data = createInitialScenario()
    expect(() => deliveredSeries(data, data.orders, period, now)).toThrow()
  })
  it('derives supply, supplier products and commercial history without exposing drafts or other buyers', () => {
    const data = createInitialScenario()
    const suppliers = supplierDirectory(data, 'bom-preco')
    expect(suppliers).toHaveLength(3)
    expect(suppliers.find((s) => s.id === 'santa-clara')).toMatchObject({ activeOfferCount: 2, completedAmount: 1890, completedCount: 3 })
    expect(suppliers.find((s) => s.id === 'horizonte')?.products).toHaveLength(0)
    expect(supplierDirectory(data, 'hortifruti-regional').find((s) => s.id === 'horizonte')?.completedAmount).toBe(880)
    expect(new Set(availableCatalog(data).map((o) => o.producerOrganizationId)).size).toBe(2)
  })
  it('excludes inactive and sold-out suppliers from availability', () => {
    const data = createInitialScenario()
    data.organizations.find((o) => o.id === 'boa-esperanca')!.active = false
    expect(availableCatalog(data).some((o) => o.producerOrganizationId === 'boa-esperanca')).toBe(false)
    data.offers.find((o) => o.id === 'offer-tomate')!.quantityKg = 250
    expect(availableCatalog(data).some((o) => o.id === 'offer-tomate')).toBe(false)
  })
  it('generates only actual operational alerts with explicit availability horizon', () => {
    const data = createInitialScenario()
    expect(operationalAlerts(data, 'santa-clara', now)).toEqual({ awaitingConfirmation: ['order-pending', 'order-future'], approachingAvailability: [], exhaustedOffers: [] })
    data.offers.find((o) => o.id === 'offer-milho-future')!.availableFrom = '2026-11-13'
    data.offers.find((o) => o.id === 'offer-tomate')!.quantityKg = 250
    expect(operationalAlerts(data, 'santa-clara', now)).toMatchObject({ approachingAvailability: ['offer-milho-future'], exhaustedOffers: ['offer-tomate'] })
    expect(operationalAlerts(data, 'horizonte', now).exhaustedOffers).toEqual([])
  })
  it('returns consistent empty projections', () => {
    const data = createInitialScenario(); data.orders = []; data.productions = []; data.offers = []
    expect(commercialIndicators([]).completedAmount).toBe(0)
    expect(availableProductionKg(data, 'santa-clara')).toBe(0)
    expect(deliveredSeries(data, [], 7, now).points.every((p) => p.amount === 0)).toBe(true)
    expect(supplierDirectory(data, 'bom-preco').every((s) => s.activeOfferCount === 0)).toBe(true)
  })
})
