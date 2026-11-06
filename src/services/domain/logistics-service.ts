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
    return this.database.transaction((data) => {
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
    })
  }
  private activeOrders(data: DomainData, operation: LogisticsOperation) {
    return operation.orderIds.map((id) => findRecord(data.orders, id)).filter((order) => order.status !== 'cancelled')
  }
  async requestTransport(actorId: string, id: string) {
    return this.database.transaction((data) => {
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
