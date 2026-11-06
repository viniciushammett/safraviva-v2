import { invariant } from '@/domain/errors'
import type { DomainData, EventType, OrderStatus } from '@/types/domain'

const transitions: Partial<Record<EventType, { from: (OrderStatus | null)[]; to?: OrderStatus }>> = {
  order_requested: { from: [null], to: 'pending_confirmation' },
  order_confirmed: { from: ['pending_confirmation'], to: 'confirmed' },
  order_rejected: { from: ['pending_confirmation'], to: 'rejected' },
  order_cancelled: { from: ['pending_confirmation', 'confirmed', 'preparing'], to: 'cancelled' },
  order_preparing: { from: ['confirmed'], to: 'preparing' },
  order_dispatched: { from: ['preparing'], to: 'in_transit' },
  order_delivered: { from: ['in_transit'], to: 'delivered' },
  order_cancellation_requested: { from: ['confirmed', 'preparing'] },
  transport_requested: { from: ['confirmed', 'preparing'] },
}
export function validateOrderHistory(data: DomainData) {
  for (const order of data.orders) {
    // Array insertion order breaks ties when two events share the same millisecond.
    const events = data.domainEvents.filter((event) => event.aggregateType === 'order' && event.aggregateId === order.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    let status: OrderStatus | null = null
    let cancellationRequested = false
    for (const event of events) {
      const rule = transitions[event.eventType]
      invariant(rule && rule.from.includes(status), 'VALIDATION', 'Histórico com transição comercial inválida.')
      invariant(event.metadata.fromStatus === status && event.metadata.toStatus === (rule.to ?? status), 'VALIDATION', 'Histórico comercial inconsistente.')
      invariant(event.timestamp >= order.requestedAt && event.timestamp <= order.updatedAt, 'VALIDATION', 'Data de evento fora do histórico do pedido.')
      if (event.eventType === 'order_cancelled' && status !== 'pending_confirmation') {
        invariant(cancellationRequested, 'VALIDATION', 'Cancelamento confirmado sem solicitação.')
      }
      if (event.eventType === 'order_cancellation_requested') cancellationRequested = true
      const actor = event.metadata.actorOrganizationId
      const buyerEvent = event.eventType === 'order_requested' || event.eventType === 'order_cancellation_requested' || (event.eventType === 'order_cancelled' && status === 'pending_confirmation')
      if (event.eventType === 'order_dispatched' || event.eventType === 'order_delivered' || event.eventType === 'transport_requested') {
        const operation = data.logistics.find((row) => row.id === event.metadata.logisticsOperationId)
        invariant(operation && operation.orderIds.includes(order.id), 'VALIDATION', 'Evento de transporte sem vínculo logístico.')
        invariant(actor === operation.partnerOrganizationId || (event.eventType === 'transport_requested' && actor === order.producerOrganizationId), 'VALIDATION', 'Responsável logístico inconsistente.')
      } else {
        invariant(actor === (buyerEvent ? order.buyerOrganizationId : order.producerOrganizationId), 'VALIDATION', 'Responsável comercial inconsistente.')
      }
      if (rule.to) status = rule.to
    }
    invariant(status === order.status, 'VALIDATION', 'Status do pedido diverge do histórico.')
  }
}
