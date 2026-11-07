import { invariant } from '@/domain/errors'
import { roundKg } from '@/domain/calculations'
import { deliveryInformationSchema } from '@/domain/logistics-schemas'
import type { DomainData, Order, Organization } from '@/types/domain'
import type { ReferenceCoordinates } from '@/types/logistics'
export interface LogisticsConfig { maxOriginKm: number; maxDestinationKm: number; fixedTripCost: number; costPerKm: number; sharedDistanceFactor: number; maxGroupOrders: number }
export const LOGISTICS_CONFIG: Readonly<LogisticsConfig> = Object.freeze({ maxOriginKm: 35, maxDestinationKm: 20, fixedTripCost: 120, costPerKm: 3, sharedDistanceFactor: 1.15, maxGroupOrders: 8 })
const cents = (n: number) => Math.round((n + Number.EPSILON) * 100)
export function geographicDistanceKm(a: ReferenceCoordinates, b: ReferenceCoordinates) {
  invariant([a, b].every((p) => Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180), 'VALIDATION', 'Coordenadas de referência inválidas.')
  const rad = Math.PI / 180
  const value = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))))
}
export function compareFreight(weights: readonly number[], distances: readonly number[], capacityKg: number, config: LogisticsConfig = LOGISTICS_CONFIG) {
  invariant(weights.length > 0 && weights.length === distances.length && weights.every((n) => Number.isFinite(n) && n > 0) && distances.every((n) => Number.isFinite(n) && n > 0) && Number.isFinite(capacityKg) && capacityKg > 0, 'VALIDATION', 'Pesos, distâncias e capacidade devem ser positivos.')
  invariant([config.fixedTripCost, config.costPerKm].every((n) => Number.isFinite(n) && n >= 0) && Number.isFinite(config.sharedDistanceFactor) && config.sharedDistanceFactor >= 1, 'VALIDATION', 'Parâmetros de custo inválidos.')
  const totalKg = roundKg(weights.reduce((sum, n) => sum + n, 0))
  invariant(totalKg <= capacityKg, 'VALIDATION', 'Peso excede a capacidade do veículo.')
  const individualCents = distances.reduce((sum, d) => sum + cents(config.fixedTripCost + d * config.costPerKm), 0)
  const referenceDistanceKm = Math.max(...distances) * config.sharedDistanceFactor
  const sharedCents = cents(config.fixedTripCost + referenceDistanceKm * config.costPerKm)
  invariant(Number.isSafeInteger(individualCents) && Number.isSafeInteger(sharedCents), 'VALIDATION', 'Estimativa fora do limite numérico.')
  const savingsCents = Math.max(0, individualCents - sharedCents)
  let allocated = 0
  const shares = weights.map((weight, index) => {
    const amount = index === weights.length - 1 ? sharedCents - allocated : Math.floor(sharedCents * weight / totalKg)
    allocated += amount
    return amount / 100
  })
  return { individualCost: individualCents / 100, sharedCost: sharedCents / 100, savingsAbsolute: savingsCents / 100, savingsPercent: individualCents === 0 ? null : savingsCents / individualCents * 100, hasEconomicAdvantage: savingsCents > 0, utilizationPercent: totalKg / capacityKg * 100, totalKg, referenceDistanceKm, shares }
}
export function logisticsEligibility(data: DomainData, order: Order) {
  if (!['confirmed', 'preparing'].includes(order.status)) return 'Situação comercial incompatível.'
  if (!data.organizations.some((o) => o.id === order.producerOrganizationId && o.active) || !data.organizations.some((o) => o.id === order.buyerOrganizationId && o.active)) return 'Organização inativa.'
  if (data.logistics.some((operation) => operation.orderIds.includes(order.id))) return 'Pedido já associado a uma operação.'
  if (data.domainEvents.some((event) => event.aggregateId === order.id && event.eventType === 'order_cancellation_requested')) return 'Há solicitação de cancelamento pendente.'
  return null
}
export function quoteLoads(data: DomainData, orders: Order[], partner: Organization, mode: 'individual' | 'shared', today: string, config: LogisticsConfig = LOGISTICS_CONFIG) {
  invariant(Number.isFinite(config.maxOriginKm) && config.maxOriginKm > 0 && Number.isFinite(config.maxDestinationKm) && config.maxDestinationKm > 0 && Number.isInteger(config.maxGroupOrders) && config.maxGroupOrders >= 2, 'VALIDATION', 'Parâmetros de compatibilidade inválidos.')
  invariant(orders.length > 0 && new Set(orders.map((o) => o.id)).size === orders.length, 'VALIDATION', 'Selecione pedidos distintos.')
  invariant(mode === 'individual' ? orders.length === 1 : orders.length >= 2, 'VALIDATION', 'Individual exige um pedido; compartilhado exige pelo menos dois.')
  const profile = partner.logisticsProfile
  invariant(partner.active && partner.type === 'logistics_partner' && profile?.available, 'VALIDATION', 'Parceiro sem disponibilidade ou perfil de transporte.')
  for (const order of orders) {
    const reason = logisticsEligibility(data, order)
    invariant(!reason, 'CONFLICT', reason ?? 'Pedido inelegível.')
    invariant(deliveryInformationSchema.safeParse(order.delivery).success && order.delivery, 'VALIDATION', 'Complete os dados logísticos dos pedidos.')
    invariant(order.delivery.weightKg === order.quantityKg && order.delivery.windowEnd >= today, 'VALIDATION', 'Peso ou janela de entrega inválidos.')
    const offer = data.offers.find((row) => row.id === order.offerId)!
    invariant(order.delivery.windowStart >= offer.availableFrom, 'VALIDATION', 'Janela anterior à disponibilidade da oferta.')
    invariant(profile.serviceStates.includes(order.delivery.origin.state) && profile.serviceStates.includes(order.delivery.destination.state), 'VALIDATION', 'Local fora da região de atendimento do parceiro.')
    invariant(order.delivery.restrictions.every((r) => profile.capabilities.includes(r)), 'VALIDATION', 'Restrições incompatíveis com o veículo.')
  }
  const deliveries = orders.map((o) => o.delivery!)
  if (mode === 'shared') {
    invariant(Math.max(...deliveries.map((d) => Date.parse(d.windowStart))) <= Math.min(...deliveries.map((d) => Date.parse(d.windowEnd))), 'VALIDATION', 'Janelas de entrega não se sobrepõem.')
    invariant(new Set(deliveries.flatMap((d) => d.restrictions.filter((r) => r === 'ambient' || r === 'refrigerated'))).size <= 1, 'VALIDATION', 'Regimes de temperatura incompatíveis.')
    for (let i = 0; i < deliveries.length; i++) for (let j = i + 1; j < deliveries.length; j++) {
      const a = deliveries[i], b = deliveries[j]
      invariant(a.origin.coordinates && b.origin.coordinates && a.destination.coordinates && b.destination.coordinates, 'VALIDATION', 'Coordenadas de referência ausentes; não é possível recomendar consolidação geográfica.')
      invariant(geographicDistanceKm(a.origin.coordinates, b.origin.coordinates) <= config.maxOriginKm, 'VALIDATION', 'Origens distantes.')
      invariant(geographicDistanceKm(a.destination.coordinates, b.destination.coordinates) <= config.maxDestinationKm, 'VALIDATION', 'Destinos distantes.')
    }
  }
  const costs = compareFreight(deliveries.map((d) => d.weightKg), deliveries.map((d) => d.referenceDistanceKm), profile.capacityKg, config)
  return { orderIds: orders.map((o) => o.id), producerIds: [...new Set(orders.map((o) => o.producerOrganizationId))], partnerId: partner.id, partnerName: partner.name, vehicleCapacityKg: profile.capacityKg, requiredCapacityKg: costs.totalKg, transportMode: mode, costs, estimatedCost: mode === 'individual' ? costs.individualCost : costs.sharedCost, requiresOtherProducers: new Set(orders.map((o) => o.producerOrganizationId)).size > 1, justification: mode === 'individual' ? 'Pedido com dados de entrega, peso e restrições compatíveis com o veículo. Estimativa por distância de referência, sem cálculo de rota rodoviária.' : 'Origens e destinos próximos, janelas sobrepostas, peso e restrições compatíveis com o veículo. Comparação estimada por distância de referência; sem otimização rodoviária.' }
}
export type LogisticsQuote = ReturnType<typeof quoteLoads>
/** Deterministic bounded greedy groups. Not an optimizer; no ownership authorization implied. */
export function consolidationOpportunities(data: DomainData, organizationId: string, today: string, config: LogisticsConfig = LOGISTICS_CONFIG): LogisticsQuote[] {
  const candidates = data.orders.filter((o) => !logisticsEligibility(data, o) && o.delivery).sort((a, b) => a.id.localeCompare(b.id))
  const results = new Map<string, LogisticsQuote>()
  for (const anchor of candidates.filter((o) => o.producerOrganizationId === organizationId)) {
    for (const partner of data.organizations.filter((o) => o.type === 'logistics_partner').sort((a, b) => a.id.localeCompare(b.id))) {
      const group = [anchor]
      for (const other of candidates) {
        if (other.id === anchor.id || group.length >= config.maxGroupOrders) continue
        try { quoteLoads(data, [...group, other], partner, 'shared', today, config); group.push(other) } catch { /* Incompatible candidates remain independent. */ }
      }
      if (group.length > 1) {
        const quote = quoteLoads(data, group, partner, 'shared', today, config)
        const key = [...quote.orderIds].sort().join('|') + '|' + partner.id
        results.set(key, quote)
      }
    }
  }
  return [...results.values()]
}
