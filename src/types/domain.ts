export type OrganizationType = 'producer' | 'buyer' | 'logistics_partner'
export interface Organization {
  id: string
  name: string
  type: OrganizationType
  city: string
  state: string
  active: boolean
}
export interface User {
  id: string
  organizationId: string
  name: string
  role: string
  active: boolean
}
export interface Product { id: string; name: string; category: string; unit: 'kg' }
export interface Production {
  id: string
  producerOrganizationId: string
  productId: string
  estimatedQuantityKg: number
  harvestedQuantityKg: number
  expectedHarvestDate: string
  status: 'growing' | 'harvested' | 'finished'
  createdAt: string
  updatedAt: string
}
export interface Offer {
  id: string
  productionId: string
  producerOrganizationId: string
  quantityKg: number
  pricePerKg: number
  availabilityType: 'immediate' | 'future'
  availableFrom: string
  status: 'draft' | 'published' | 'paused' | 'closed'
  createdAt: string
  updatedAt: string
}
export type OrderStatus = 'pending_confirmation' | 'confirmed' | 'preparing' | 'in_transit' | 'delivered' | 'rejected' | 'cancelled'
export interface Order {
  id: string
  offerId: string
  producerOrganizationId: string
  buyerOrganizationId: string
  quantityKg: number
  unitPrice: number
  totalAmount: number
  status: OrderStatus
  requestedAt: string
  updatedAt: string
}
export interface LogisticsOperation {
  id: string
  partnerOrganizationId: string
  orderIds: string[]
  transportMode: 'individual' | 'shared'
  vehicleCapacityKg: number
  totalLoadKg: number
  estimatedCost: number
  status: 'awaiting_organization' | 'transport_requested' | 'in_transit' | 'delivered'
  createdAt: string
  updatedAt: string
}
export interface MarketAnalysis {
  id: string
  productId: string
  region: string
  periodDays: number
  estimatedDemandKg: number
  estimatedSupplyKg: number
  referencePricePerKg: number
  trend: 'growing' | 'stable' | 'declining'
  calculatedAt: string
  methodology: string
}
export type AggregateType = 'production' | 'offer' | 'order' | 'logistics'
export type EventType =
  | 'production_created' | 'production_updated'
  | 'offer_created' | 'offer_updated' | 'offer_published' | 'offer_paused' | 'offer_closed'
  | 'order_requested' | 'order_confirmed' | 'order_rejected' | 'order_cancelled'
  | 'order_cancellation_requested' | 'order_preparing' | 'order_dispatched' | 'order_delivered'
  | 'logistics_transport_requested' | 'logistics_created' | 'transport_requested' | 'logistics_dispatched' | 'logistics_delivered'
export interface DomainEvent {
  id: string
  aggregateType: AggregateType
  aggregateId: string
  eventType: EventType
  timestamp: string
  metadata: Record<string, unknown>
}
// Idempotency receipts are infrastructure records, not commercial aggregates.
export interface CommandReceipt { id: string; fingerprint: string; resultId: string; collection: 'orders' }
export interface DomainData {
  organizations: Organization[]
  users: User[]
  products: Product[]
  productions: Production[]
  offers: Offer[]
  orders: Order[]
  logistics: LogisticsOperation[]
  marketAnalyses: MarketAnalysis[]
  domainEvents: DomainEvent[]
  commandReceipts: CommandReceipt[]
}
export type Collection = keyof DomainData
