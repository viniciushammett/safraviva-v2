import type { DomainData, OrganizationType } from '@/types/domain'
import { allocatedProductionQuantity, commercialVolume, committedQuantity, isCommitted, orderTotal, roundKg } from '@/domain/calculations'
import { invariant } from '@/domain/errors'
import { validateOrderHistory } from '@/domain/order-history'
import { domainDataSchema } from '@/domain/schemas'

export function validateDomainData(input: unknown): DomainData {
  const parsed = domainDataSchema.safeParse(input)
  invariant(parsed.success, 'VALIDATION', 'Dados de domínio inválidos: ' + (parsed.error?.issues[0]?.message ?? 'schema'))
  const data: DomainData = parsed.data
  for (const rows of Object.values(data) as Array<Array<{ id: string }>>) {
    invariant(new Set(rows.map((row) => row.id)).size === rows.length, 'VALIDATION', 'Identificadores duplicados.')
  }
  function org(id: string, type?: OrganizationType) {
    const organization = data.organizations.find((row) => row.id === id)
    invariant(organization && (!type || organization.type === type), 'VALIDATION', 'Referência de organização incompatível.')
  }
  for (const user of data.users) org(user.organizationId)
  for (const production of data.productions) {
    org(production.producerOrganizationId, 'producer')
    invariant(data.products.some((row) => row.id === production.productId), 'VALIDATION', 'Produto inexistente.')
    invariant(allocatedProductionQuantity(data, production.id) <= commercialVolume(production), 'INSUFFICIENT_STOCK', 'Ofertas excedem o volume comercializável.')
    invariant(production.createdAt <= production.updatedAt, 'VALIDATION', 'Datas da produção inconsistentes.')
  }
  for (const offer of data.offers) {
    const production = data.productions.find((row) => row.id === offer.productionId)
    invariant(production && production.producerOrganizationId === offer.producerOrganizationId, 'VALIDATION', 'Produção da oferta inexistente ou incompatível.')
    invariant(committedQuantity(data, offer.id) <= offer.quantityKg, 'INSUFFICIENT_STOCK', 'Quantidade inferior ao volume comprometido.')
    invariant(offer.availabilityType !== 'immediate' || production.status !== 'growing', 'VALIDATION', 'Oferta imediata exige produção colhida.')
    invariant(offer.availabilityType !== 'future' || offer.availableFrom >= production.expectedHarvestDate, 'VALIDATION', 'Oferta anterior à colheita prevista.')
    invariant(offer.createdAt <= offer.updatedAt, 'VALIDATION', 'Datas da oferta inconsistentes.')
  }
  for (const order of data.orders) {
    invariant(!order.delivery || order.delivery.weightKg === order.quantityKg, 'VALIDATION', 'Peso logístico deve corresponder à quantidade do pedido.')
    const offer = data.offers.find((row) => row.id === order.offerId)
    invariant(offer && offer.producerOrganizationId === order.producerOrganizationId, 'VALIDATION', 'Oferta do pedido inexistente ou incompatível.')
    org(order.producerOrganizationId, 'producer')
    org(order.buyerOrganizationId, 'buyer')
    invariant(order.totalAmount === orderTotal(order.quantityKg, order.unitPrice), 'VALIDATION', 'Total do pedido inconsistente.')
    invariant(order.requestedAt <= order.updatedAt, 'VALIDATION', 'Datas do pedido inconsistentes.')
  }
  const assignedOrders = new Set<string>()
  for (const operation of data.logistics) {
    org(operation.partnerOrganizationId, 'logistics_partner')
    invariant(new Set(operation.orderIds).size === operation.orderIds.length, 'VALIDATION', 'Pedido repetido no transporte.')
    const orders = operation.orderIds.map((id) => data.orders.find((row) => row.id === id))
    invariant(orders.every((order) => order && (isCommitted(order) || order.status === 'cancelled')), 'VALIDATION', 'Transporte exige pedidos comprometidos existentes.')
    const load = roundKg(orders.reduce((sum, order) => sum + (isCommitted(order!) ? order!.quantityKg : 0), 0))
    invariant(load === operation.totalLoadKg && load <= operation.vehicleCapacityKg, 'VALIDATION', 'Carga ou capacidade logística inconsistente.')
    invariant(operation.transportMode !== 'individual' || orders.length === 1, 'VALIDATION', 'Transporte individual exige um pedido.')
    invariant(!['in_transit', 'delivered'].includes(operation.status) || load > 0, 'VALIDATION', 'Transporte iniciado sem carga.')
    invariant(operation.createdAt <= operation.updatedAt, 'VALIDATION', 'Datas logísticas inconsistentes.')
    for (const order of orders) {
      invariant(!assignedOrders.has(order!.id), 'CONFLICT', 'Pedido já vinculado a uma operação logística.')
      assignedOrders.add(order!.id)
      const statuses = operation.status === 'delivered' ? ['delivered', 'cancelled'] : operation.status === 'in_transit' ? ['in_transit', 'cancelled'] : ['confirmed', 'preparing', 'cancelled']
      invariant(statuses.includes(order!.status), 'VALIDATION', 'Estados comercial e logístico incompatíveis.')
    }
  }
  for (const order of data.orders.filter((row) => ['in_transit', 'delivered'].includes(row.status))) {
    invariant(assignedOrders.has(order.id), 'VALIDATION', 'Pedido transportado sem operação logística.')
  }
  for (const analysis of data.marketAnalyses) {
    invariant(data.products.some((row) => row.id === analysis.productId), 'VALIDATION', 'Produto da análise inexistente.')
  }
  const aggregates = { production: data.productions, offer: data.offers, order: data.orders, logistics: data.logistics }
  for (const event of data.domainEvents) {
    invariant(aggregates[event.aggregateType].some((row) => row.id === event.aggregateId), 'VALIDATION', 'Agregado do evento inexistente.')
    const prefix = event.eventType.startsWith('transport_') ? 'order' : event.eventType.split('_')[0]
    invariant(prefix === event.aggregateType, 'VALIDATION', 'Tipo de evento incompatível com agregado.')
    if (event.metadata.actorOrganizationId !== undefined) org(String(event.metadata.actorOrganizationId))
    if (event.metadata.logisticsOperationId !== undefined) invariant(data.logistics.some((row) => row.id === event.metadata.logisticsOperationId), 'VALIDATION', 'Operação do evento inexistente.')
  }
  for (const receipt of data.commandReceipts) {
    invariant(data.orders.some((row) => row.id === receipt.resultId), 'VALIDATION', 'Resultado idempotente inexistente.')
  }
  validateOrderHistory(data)
  return data
}
