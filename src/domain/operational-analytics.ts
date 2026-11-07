import { availableQuantity, commercialTotals, commercialVolume, committedQuantity, roundKg } from '@/domain/calculations'
import { invariant } from '@/domain/errors'
import type { DomainData, Order } from '@/types/domain'
export const DASHBOARD_PERIODS = [7, 30, 90] as const
export type DashboardPeriod = typeof DASHBOARD_PERIODS[number]
export const DASHBOARD_CONFIG = Object.freeze({ recentOrdersLimit: 5, opportunityLimit: 3, availabilityAlertDays: 7 })
export function scopedOrders(data: DomainData, organizationId: string, profile: 'producer' | 'buyer') {
  return data.orders.filter((o) => profile === 'producer' ? o.producerOrganizationId === organizationId : o.buyerOrganizationId === organizationId)
}
export function availableProductionKg(data: DomainData, organizationId: string) {
  return roundKg(data.productions.filter((p) => p.producerOrganizationId === organizationId && p.status !== 'finished').reduce((sum, p) => sum + commercialVolume(p) - data.offers.filter((o) => o.productionId === p.id).reduce((used, o) => used + committedQuantity(data, o.id), 0), 0))
}
export function commercialIndicators(orders: readonly Order[]) {
  const completed = orders.filter((o) => o.status === 'delivered')
  return { completedAmount: commercialTotals(completed).totalAmount, completedCount: completed.length, pendingCount: orders.filter((o) => o.status === 'pending_confirmation').length, inProgressCount: orders.filter((o) => ['confirmed', 'preparing', 'in_transit'].includes(o.status)).length }
}
/** UTC calendar days including today. Money is accumulated from the immutable order totals. */
export function deliveredSeries(data: DomainData, orders: readonly Order[], periodDays: number, now: string) {
  invariant(DASHBOARD_PERIODS.includes(periodDays as DashboardPeriod) && Number.isFinite(Date.parse(now)), 'VALIDATION', 'Período ou referência inválidos.')
  const today = Date.parse(`${now.slice(0, 10)}T00:00:00.000Z`)
  const start = today - (periodDays - 1) * 86400000
  const points = Array.from({ length: periodDays }, (_, i) => ({ date: new Date(start + i * 86400000).toISOString().slice(0, 10), amount: 0, orderCount: 0 }))
  let missingDeliveryDate = 0
  for (const order of orders.filter((o) => o.status === 'delivered')) {
    const event = data.domainEvents.find((e) => e.aggregateType === 'order' && e.aggregateId === order.id && e.eventType === 'order_delivered')
    if (!event || !Number.isFinite(Date.parse(event.timestamp))) { missingDeliveryDate++; continue }
    const timestamp = Date.parse(event.timestamp)
    if (timestamp < start || timestamp > Date.parse(now)) continue
    const point = points.find((p) => p.date === event.timestamp.slice(0, 10))
    if (point) { point.amount = Math.round((point.amount + order.totalAmount) * 100) / 100; point.orderCount++ }
  }
  return { points, totalAmount: Math.round(points.reduce((sum, p) => sum + p.amount, 0) * 100) / 100, orderCount: points.reduce((sum, p) => sum + p.orderCount, 0), missingDeliveryDate, startDate: points[0].date, endDate: now.slice(0, 10) }
}
export function availableCatalog(data: DomainData) {
  return data.offers.filter((o) => o.status === 'published' && availableQuantity(data, o) > 0 && data.organizations.some((org) => org.id === o.producerOrganizationId && org.active)).map((offer) => {
    const producer = data.organizations.find((o) => o.id === offer.producerOrganizationId)!
    const production = data.productions.find((p) => p.id === offer.productionId)!
    const product = data.products.find((p) => p.id === production.productId)!
    return { ...offer, availableQuantityKg: availableQuantity(data, offer), productName: product.name, category: product.category, producerName: producer.name, region: `${producer.city}/${producer.state}` }
  })
}
export function supplierDirectory(data: DomainData, buyerId: string) {
  const catalog = availableCatalog(data)
  return data.organizations.filter((o) => o.type === 'producer').map((supplier) => {
    const offers = catalog.filter((o) => o.producerOrganizationId === supplier.id)
    const completed = data.orders.filter((o) => o.buyerOrganizationId === buyerId && o.producerOrganizationId === supplier.id && o.status === 'delivered')
    const productIds = new Set([...data.offers.filter((o) => o.producerOrganizationId === supplier.id && o.status === 'published').map((o) => data.productions.find((p) => p.id === o.productionId)!.productId), ...completed.map((o) => data.productions.find((p) => p.id === data.offers.find((offer) => offer.id === o.offerId)!.productionId)!.productId)])
    return { id: supplier.id, name: supplier.name, city: supplier.city, state: supplier.state, active: supplier.active, products: data.products.filter((p) => productIds.has(p.id)), offers, activeOfferCount: offers.length, completedAmount: commercialTotals(completed).totalAmount, completedCount: completed.length, completedOrders: completed.map((o) => ({ ...o, productName: data.products.find((p) => p.id === data.productions.find((p) => p.id === data.offers.find((offer) => offer.id === o.offerId)!.productionId)!.productId)!.name })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)) }
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
export function operationalAlerts(data: DomainData, organizationId: string, now: string) {
  const today = now.slice(0, 10)
  const end = new Date(Date.parse(`${today}T00:00:00.000Z`) + DASHBOARD_CONFIG.availabilityAlertDays * 86400000).toISOString().slice(0, 10)
  const ownOffers = data.offers.filter((o) => o.producerOrganizationId === organizationId && o.status === 'published')
  return {
    awaitingConfirmation: scopedOrders(data, organizationId, 'producer').filter((o) => o.status === 'pending_confirmation').map((o) => o.id),
    approachingAvailability: ownOffers.filter((o) => o.availabilityType === 'future' && o.availableFrom >= today && o.availableFrom <= end && availableQuantity(data, o) > 0).map((o) => o.id),
    exhaustedOffers: ownOffers.filter((o) => availableQuantity(data, o) === 0).map((o) => o.id),
  }
}
