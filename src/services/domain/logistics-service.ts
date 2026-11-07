import { addLogisticsReferenceScenario } from '@/data/logistics-demo'
import { consolidationOpportunities, logisticsEligibility, quoteLoads, type LogisticsQuote } from '@/domain/logistics-planning'
import { deliveryInformationSchema } from '@/domain/logistics-schemas'
import type { DeliveryInformation } from '@/types/logistics'
import { invariant } from '@/domain/errors'
import { roundKg } from '@/domain/calculations'
import { createLogisticsSchema } from '@/domain/schemas'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'
import type { DomainData, LogisticsOperation } from '@/types/domain'
import { defaultEnvironment, findRecord, recordEvent, requireOrganization, requireOwner, type CommandEnvironment } from '@/services/domain/command-context'

export type CreateLogisticsInput = Omit<LogisticsOperation, 'id' | 'totalLoadKg' | 'status' | 'createdAt' | 'updatedAt'>
export class LogisticsService {
  constructor(private readonly database: DomainUnitOfWork, private readonly env: CommandEnvironment = defaultEnvironment) {}
  async createOperation(actorId: string, input: CreateLogisticsInput) {
    const parsed = createLogisticsSchema.safeParse(input)
    invariant(parsed.success, 'VALIDATION', parsed.error?.issues[0]?.message ?? 'Dados logísticos inválidos.')
    const values = parsed.data
    return this.database.transaction((data) => this.createInDraft(data, actorId, values))
  }
  private createInDraft(data: DomainData, actorId: string, values: CreateLogisticsInput) {
      requireOrganization(data, actorId, 'producer')
      requireOrganization(data, values.partnerOrganizationId, 'logistics_partner')
      invariant(new Set(values.orderIds).size === values.orderIds.length, 'VALIDATION', 'Pedidos duplicados na operação.')
      const orders = values.orderIds.map((id) => findRecord(data.orders, id))
      for (const order of orders) {
        requireOwner(order.producerOrganizationId, actorId)
        invariant(['confirmed', 'preparing'].includes(order.status), 'INVALID_TRANSITION', 'Transporte exige pedidos confirmados ou em preparação.')
        invariant(!data.logistics.some((row) => row.orderIds.includes(order.id)), 'CONFLICT', 'Pedido já associado a uma operação logística.')
      }
      const totalLoadKg = roundKg(orders.reduce((sum, row) => sum + row.quantityKg, 0))
      invariant(totalLoadKg <= values.vehicleCapacityKg, 'VALIDATION', 'Carga superior à capacidade do veículo.')
      invariant(values.transportMode !== 'individual' || orders.length === 1, 'VALIDATION', 'Transporte individual exige um único pedido.')
      const now = this.env.now()
      const operation: LogisticsOperation = { ...values, id: this.env.id(), totalLoadKg, status: 'awaiting_organization', createdAt: now, updatedAt: now }
      data.logistics.push(operation)
      recordEvent(data, this.env, 'logistics', operation.id, 'logistics_created', { actorOrganizationId: actorId, toStatus: operation.status, orderIds: operation.orderIds, partnerOrganizationId: operation.partnerOrganizationId, totalLoadKg }, now)
      return operation
  }

  private activeOrders(data: DomainData, operation: LogisticsOperation) {
    return operation.orderIds.map((id) => findRecord(data.orders, id)).filter((order) => order.status !== 'cancelled')
  }
  async requestTransport(actorId: string, id: string) {
    return this.database.transaction((data) => this.requestInDraft(data, actorId, id))
  }
  private requestInDraft(data: DomainData, actorId: string, id: string) {
      requireOrganization(data, actorId, 'producer')
      const operation = findRecord(data.logistics, id)
      const orders = this.activeOrders(data, operation)
      invariant(orders.length > 0, 'INVALID_TRANSITION', 'Operação sem pedidos ativos.')
      for (const order of orders) requireOwner(order.producerOrganizationId, actorId)
      requireOrganization(data, operation.partnerOrganizationId, 'logistics_partner')
      invariant(operation.status === 'awaiting_organization', 'INVALID_TRANSITION', 'Operação não está aguardando organização.')
      operation.status = 'transport_requested'
      operation.updatedAt = this.env.now()
      recordEvent(data, this.env, 'logistics', id, 'logistics_transport_requested', { actorOrganizationId: actorId, fromStatus: 'awaiting_organization', toStatus: operation.status }, operation.updatedAt)
      for (const order of orders) {
        order.updatedAt = operation.updatedAt
        recordEvent(data, this.env, 'order', order.id, 'transport_requested', { actorOrganizationId: actorId, logisticsOperationId: id, fromStatus: order.status, toStatus: order.status }, operation.updatedAt)
      }
      return operation
  }

  async importReferenceScenario(actorId: string, confirmation: { confirmed: boolean }) {
    invariant(confirmation.confirmed, 'CONFIRMATION_REQUIRED', 'Confirme a importação dos registros sintéticos.')
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      return addLogisticsReferenceScenario(data, this.env.now())
    })
  }
  async saveDelivery(actorId: string, orderId: string, input: DeliveryInformation) {
    const parsed = deliveryInformationSchema.safeParse(input)
    invariant(parsed.success, 'VALIDATION', parsed.error?.issues[0]?.message ?? 'Dados de entrega inválidos.')
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const order = findRecord(data.orders, orderId)
      requireOwner(order.producerOrganizationId, actorId)
      invariant(['pending_confirmation', 'confirmed', 'preparing'].includes(order.status), 'INVALID_TRANSITION', 'Entrega não pode ser revisada neste estado.')
      invariant(!data.logistics.some((op) => op.orderIds.includes(orderId) && op.status !== 'awaiting_organization'), 'CONFLICT', 'Transporte já solicitado; não é possível alterar a entrega.')
      invariant(parsed.data.weightKg === order.quantityKg, 'VALIDATION', 'Peso deve corresponder ao pedido.')
      invariant(parsed.data.windowEnd >= this.env.now().slice(0, 10), 'VALIDATION', 'A janela de entrega já terminou.')
      invariant(parsed.data.windowStart >= findRecord(data.offers, order.offerId).availableFrom, 'VALIDATION', 'Janela anterior à disponibilidade da oferta.')
      order.delivery = parsed.data
      order.updatedAt = this.env.now()
      recordEvent(data, this.env, 'order', order.id, 'order_delivery_updated', { actorOrganizationId: actorId, fromStatus: order.status, toStatus: order.status }, order.updatedAt)
      return order.delivery
    })
  }
  async planningWorkspace(actorId: string) {
    const data = await this.database.snapshot()
    requireOrganization(data, actorId, 'producer')
    const describe = (order: DomainData['orders'][number]) => ({ id: order.id, producerOrganizationId: order.producerOrganizationId, producerName: findRecord(data.organizations, order.producerOrganizationId).name, buyerName: findRecord(data.organizations, order.buyerOrganizationId).name, productName: findRecord(data.products, findRecord(data.productions, findRecord(data.offers, order.offerId).productionId).productId).name, quantityKg: order.quantityKg, status: order.status, delivery: order.delivery })
    const own = data.orders.filter((o) => o.producerOrganizationId === actorId)
    const opportunities = consolidationOpportunities(data, actorId, this.env.now().slice(0, 10))
    return {
      pending: own.filter((o) => !logisticsEligibility(data, o)).map(describe),
      reviewable: own.filter((o) => ['pending_confirmation', 'confirmed', 'preparing'].includes(o.status)).map(describe),
      opportunities: opportunities.map((quote) => ({ ...quote, loads: quote.orderIds.map((id) => describe(findRecord(data.orders, id))) })),
      partners: data.organizations.filter((o) => o.type === 'logistics_partner' && o.active),
      operations: data.logistics.filter((op) => op.orderIds.some((id) => own.some((o) => o.id === id))).map((op) => ({ ...op, partnerName: findRecord(data.organizations, op.partnerOrganizationId).name, loads: op.orderIds.map((id) => describe(findRecord(data.orders, id))), history: data.domainEvents.filter((event) => event.aggregateType === 'logistics' && event.aggregateId === op.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp)) })),
    }
  }
  async quoteTransport(actorId: string, orderIds: string[], partnerId: string, mode: 'individual' | 'shared') {
    const data = await this.database.snapshot()
    requireOrganization(data, actorId, 'producer')
    const orders = orderIds.map((id) => findRecord(data.orders, id))
    invariant(orders.some((o) => o.producerOrganizationId === actorId), 'FORBIDDEN', 'Selecione um pedido próprio para análise.')
    return quoteLoads(data, orders, findRecord(data.organizations, partnerId), mode, this.env.now().slice(0, 10))
  }
  async organizeTransport(actorId: string, input: { orderIds: string[]; partnerId: string; mode: 'individual' | 'shared'; expectedQuote?: LogisticsQuote }) {
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const orders = input.orderIds.map((id) => findRecord(data.orders, id))
      for (const order of orders) requireOwner(order.producerOrganizationId, actorId)
      const quote = quoteLoads(data, orders, findRecord(data.organizations, input.partnerId), input.mode, this.env.now().slice(0, 10))
      invariant(!input.expectedQuote || JSON.stringify(input.expectedQuote) === JSON.stringify(quote), 'CONFLICT', 'A estimativa mudou. Compare os custos novamente antes de confirmar.')
      const operation = this.createInDraft(data, actorId, { orderIds: quote.orderIds, partnerOrganizationId: quote.partnerId, transportMode: input.mode, vehicleCapacityKg: quote.vehicleCapacityKg, estimatedCost: quote.estimatedCost })
      return this.requestInDraft(data, actorId, operation.id)
    })
  }
  async requestReviewedTransport(actorId: string, operationId: string) {
    return this.database.transaction((data) => {
      const operation = findRecord(data.logistics, operationId)
      const orders = this.activeOrders(data, operation)
      for (const order of orders) requireOwner(order.producerOrganizationId, actorId)
      const withoutCurrent = { ...data, logistics: data.logistics.filter((op) => op.id !== operation.id) }
      quoteLoads(withoutCurrent, orders, findRecord(data.organizations, operation.partnerOrganizationId), operation.transportMode, this.env.now().slice(0, 10))
      return this.requestInDraft(data, actorId, operation.id)
    })
  }
  async dispatch(actorId: string, id: string) { return this.advance(actorId, id, false) }
  async deliver(actorId: string, id: string) { return this.advance(actorId, id, true) }
  private async advance(actorId: string, id: string, delivered: boolean) {
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'logistics_partner')
      const operation = findRecord(data.logistics, id)
      requireOwner(operation.partnerOrganizationId, actorId)
      invariant(operation.status === (delivered ? 'in_transit' : 'transport_requested'), 'INVALID_TRANSITION', 'Transição logística inválida.')
      const orders = this.activeOrders(data, operation)
      invariant(orders.length > 0, 'INVALID_TRANSITION', 'Operação sem pedidos ativos.')
      const now = this.env.now()
      for (const order of orders) {
        requireOrganization(data, order.producerOrganizationId, 'producer')
        requireOrganization(data, order.buyerOrganizationId, 'buyer')
        invariant(order.status === (delivered ? 'in_transit' : 'preparing'), 'INVALID_TRANSITION', 'Pedido em estado incompatível com o transporte.')
        const fromStatus = order.status
        order.status = delivered ? 'delivered' : 'in_transit'
        order.updatedAt = now
        recordEvent(data, this.env, 'order', order.id, delivered ? 'order_delivered' : 'order_dispatched', { actorOrganizationId: actorId, logisticsOperationId: id, fromStatus, toStatus: order.status }, now)
      }
      const fromStatus = operation.status
      operation.status = delivered ? 'delivered' : 'in_transit'
      operation.updatedAt = now
      recordEvent(data, this.env, 'logistics', id, delivered ? 'logistics_delivered' : 'logistics_dispatched', { actorOrganizationId: actorId, fromStatus, toStatus: operation.status }, now)
      return operation
    })
  }
}
