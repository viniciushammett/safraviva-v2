import type { DomainData, Offer, Order, Production } from '@/types/domain'

// Quantities: 3 decimal places (grams). Currency: centavos; unit prices: 2 decimals.
export const roundKg = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000
export const orderTotal = (quantityKg: number, unitPrice: number) => Math.round(Math.round(quantityKg * 1000) * Math.round(unitPrice * 100) / 1000) / 100
export function isCommitted(order: Order) {
  return ['confirmed', 'preparing', 'in_transit', 'delivered'].includes(order.status)
}
export function committedQuantity(data: DomainData, offerId: string) {
  return roundKg(data.orders.filter((order) => order.offerId === offerId && isCommitted(order)).reduce((sum, order) => sum + order.quantityKg, 0))
}
export function availableQuantity(data: DomainData, offer: Offer) {
  return roundKg(offer.quantityKg - committedQuantity(data, offer.id))
}
export function commercialVolume(production: Production) {
  return production.status === 'growing' ? production.estimatedQuantityKg : production.harvestedQuantityKg
}
// Closing an offer releases only its uncommitted remainder; delivered volume stays consumed.
export function allocatedProductionQuantity(data: DomainData, productionId: string) {
  return roundKg(data.offers.filter((offer) => offer.productionId === productionId).reduce((sum, offer) => sum + (offer.status === 'closed' ? committedQuantity(data, offer.id) : offer.quantityKg), 0))
}
export function commercialTotals(orders: readonly Order[]) {
  const committed = orders.filter(isCommitted)
  return {
    quantityKg: roundKg(committed.reduce((sum, order) => sum + order.quantityKg, 0)),
    totalAmount: Math.round(committed.reduce((sum, order) => sum + order.totalAmount, 0) * 100) / 100,
  }
}
