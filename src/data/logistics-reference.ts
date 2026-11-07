import type { LogisticsPartnerProfile } from '@/types/logistics'
export const referencePartners: Record<string, LogisticsPartnerProfile> = {
  'rotas-do-campo': { vehicleType: 'Veículo de referência com carga seca', capacityKg: 1000, serviceStates: ['SP'], available: true, capabilities: ['ambient', 'fragile'], source: 'synthetic' },
  'carga-verde': { vehicleType: 'Veículo de referência refrigerado', capacityKg: 1200, serviceStates: ['SP'], available: true, capabilities: ['refrigerated', 'fragile'], source: 'synthetic' },
}
