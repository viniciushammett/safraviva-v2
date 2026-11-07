import type { OrderStatus } from '@/types/domain'
import type { OrderAction } from '@/domain/order-actions'
import type { DomainQueryService } from '@/services/domain/query-service'
export type MarketOffer = Awaited<ReturnType<DomainQueryService['marketplace']>>[number]
export type OrderView = Awaited<ReturnType<DomainQueryService['ordersWorkspace']>>[number]
export const orderStatuses: Record<OrderStatus, string> = { pending_confirmation: 'Aguardando confirmação', confirmed: 'Confirmado', preparing: 'Em preparação', in_transit: 'Em transporte', delivered: 'Entregue', rejected: 'Recusado', cancelled: 'Cancelado' }
export const actionLabels: Record<OrderAction, string> = { confirmOrder: 'Aceitar pedido', rejectOrder: 'Recusar pedido', prepareOrder: 'Iniciar preparação', requestCancellation: 'Solicitar cancelamento', approveCancellation: 'Aprovar cancelamento' }
export const eventLabels: Record<string, string> = { order_delivery_updated: 'Informações de entrega revisadas', order_requested: 'Solicitação enviada', order_confirmed: 'Pedido confirmado', order_preparing: 'Preparação iniciada', transport_requested: 'Transporte solicitado', order_dispatched: 'Transporte iniciado', order_delivered: 'Entrega concluída', order_rejected: 'Pedido recusado', order_cancelled: 'Pedido cancelado', order_cancellation_requested: 'Cancelamento solicitado pelo comprador' }
export const logisticsStatuses = { awaiting_organization: 'Aguardando organização', transport_requested: 'Transporte solicitado', in_transit: 'Em transporte', delivered: 'Entregue' }
export const timestampLabel = (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(date))
export function orderActionLabel(action: OrderAction, order: OrderView) { return action === 'requestCancellation' && order.status === 'pending_confirmation' ? 'Cancelar pedido' : actionLabels[action] }
