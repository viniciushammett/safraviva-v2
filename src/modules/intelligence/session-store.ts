import { create } from 'zustand'
import type { CommercialPlanInput, MarketIntelligenceService, MarketQuery, MarketQueryResult } from '@/services/domain/market-intelligence-service'
export type SimulationResult = Awaited<ReturnType<MarketIntelligenceService['simulate']>>
interface IntelligenceSession {
  filters: MarketQuery
  analysis: { result: MarketQueryResult; revision: number } | null
  plan: Partial<CommercialPlanInput>
  simulation: { result: SimulationResult; input: CommercialPlanInput; revision: number } | null
}
// Session-only presentation state. Domain repositories remain authoritative.
export const useIntelligenceSession = create<IntelligenceSession>(() => ({ filters: { productId: '', region: '', periodDays: 30 }, analysis: null, plan: {}, simulation: null }))
