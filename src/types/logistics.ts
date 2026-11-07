export type TransportRestriction = 'ambient' | 'refrigerated' | 'fragile'
export interface ReferenceCoordinates { latitude: number; longitude: number; source: 'synthetic' | 'provided_reference' }
export interface DeliveryLocation { label: string; city: string; state: string; coordinates?: ReferenceCoordinates }
export interface DeliveryInformation {
  origin: DeliveryLocation
  destination: DeliveryLocation
  windowStart: string
  windowEnd: string
  weightKg: number
  restrictions: TransportRestriction[]
  referenceDistanceKm: number
}
export interface LogisticsPartnerProfile {
  vehicleType: string
  capacityKg: number
  serviceStates: string[]
  available: boolean
  capabilities: TransportRestriction[]
  source: 'synthetic' | 'provided_reference'
}
