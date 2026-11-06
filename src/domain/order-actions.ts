import type { Order, OrganizationType } from '@/types/domain'
export type OrderAction = 'confirmOrder' | 'rejectOrder' | 'prepareOrder' | 'requestCancellation' | 'approveCancellation'
/** Presentation permissions mirror supported commands; commands revalidate the live state. */
export function availableOrderActions(order: Order, profile: OrganizationType, cancellationRequested: boolean): OrderAction[] {
  if (profile === 'producer') {
    if (order.status === 'pending_confirmation') return ['confirmOrder', 'rejectOrder']
    if (order.status === 'confirmed') return cancellationRequested ? ['prepareOrder', 'approveCancellation'] : ['prepareOrder']
    if (order.status === 'preparing' && cancellationRequested) return ['approveCancellation']
  }
  if (profile === 'buyer' && (order.status === 'pending_confirmation' || (['confirmed', 'preparing'].includes(order.status) && !cancellationRequested))) return ['requestCancellation']
  return []
}
