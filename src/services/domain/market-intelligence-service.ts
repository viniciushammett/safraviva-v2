import { z } from 'zod'
import { createProductionSchema, marketAnalysisSchema } from '@/domain/schemas'
import { invariant } from '@/domain/errors'
import { demandGapKg, demandSupplyRatio, MARKET_PERIODS, potentialGrossRevenue, priceDifferencePercent, recommendMarket, type MarketPeriod } from '@/domain/market-intelligence'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'
import type { MarketAnalysis, Product } from '@/types/domain'

export interface MarketQuery { productId: string; region: string; periodDays: number }
export type UnavailableReason = 'invalid_period' | 'product_not_found' | 'region_not_found' | 'no_data' | 'insufficient_data'
export type MarketQueryResult = { status: 'unavailable'; reason: UnavailableReason } | {
  status: 'available'
  product: Product
  analysis: MarketAnalysis
  indicators: { demandGapKg: number; demandSupplyRatio: number | null; demandSupplyPercent: number | null }
  guidance: ReturnType<typeof recommendMarket>
}
const simulationSchema = createProductionSchema.pick({ productId: true, estimatedQuantityKg: true, expectedHarvestDate: true }).extend({ region: z.string().trim().min(1), desiredPricePerKg: z.number().finite().positive().max(1e9).refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.00001) })
export interface CommercialPlanInput { productId: string; region: string; plannedQuantityKg: number; expectedHarvestDate: string; desiredPricePerKg: number }

/** Read-only service: no transaction or storage access. Latest exact match wins. */
export class MarketIntelligenceService {
  constructor(private readonly database: Pick<DomainUnitOfWork, 'snapshot'>) {}

  async query(input: MarketQuery): Promise<MarketQueryResult> {
    if (!MARKET_PERIODS.includes(input.periodDays as MarketPeriod)) return { status: 'unavailable', reason: 'invalid_period' }
    const data = await this.database.snapshot()
    const product = data.products.find((row) => row.id === input.productId)
    if (!product) return { status: 'unavailable', reason: 'product_not_found' }
    if (!data.marketAnalyses.some((row) => row.region === input.region)) return { status: 'unavailable', reason: 'region_not_found' }
    const analysis = data.marketAnalyses.filter((row) => row.productId === input.productId && row.region === input.region && row.periodDays === input.periodDays).sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt) || a.id.localeCompare(b.id))[0]
    if (!analysis) return { status: 'unavailable', reason: 'no_data' }
    if (!marketAnalysisSchema.safeParse(analysis).success || recommendMarket(analysis).condition === 'insufficient_data') return { status: 'unavailable', reason: 'insufficient_data' }
    const ratio = demandSupplyRatio(analysis.estimatedDemandKg, analysis.estimatedSupplyKg)
    return { status: 'available', product: structuredClone(product), analysis: structuredClone(analysis), indicators: { demandGapKg: demandGapKg(analysis.estimatedDemandKg, analysis.estimatedSupplyKg), demandSupplyRatio: ratio, demandSupplyPercent: ratio === null ? null : ratio * 100 }, guidance: recommendMarket(analysis) }
  }

  async simulate(input: CommercialPlanInput) {
    const parsed = simulationSchema.safeParse({ productId: input.productId, region: input.region, estimatedQuantityKg: input.plannedQuantityKg, expectedHarvestDate: input.expectedHarvestDate, desiredPricePerKg: input.desiredPricePerKg })
    invariant(parsed.success, 'VALIDATION', parsed.error?.issues[0]?.message ?? 'Planejamento inválido.')
    // No extrapolation to the harvest date: this is explicitly a 30-day reference scenario.
    const market = await this.query({ productId: parsed.data.productId, region: parsed.data.region, periodDays: 30 })
    const analysis = market.status === 'available' ? market.analysis : null
    return {
      potentialGrossRevenue: potentialGrossRevenue(input.plannedQuantityKg, input.desiredPricePerKg),
      referencePricePerKg: analysis?.referencePricePerKg ?? null,
      priceDifferencePercent: analysis ? priceDifferencePercent(input.desiredPricePerKg, analysis.referencePricePerKg) : null,
      ...recommendMarket(analysis, input.desiredPricePerKg),
      market,
      productionDraft: { productId: parsed.data.productId, estimatedQuantityKg: parsed.data.estimatedQuantityKg, harvestedQuantityKg: 0, expectedHarvestDate: parsed.data.expectedHarvestDate, status: 'growing' as const },
      region: parsed.data.region,
      disclaimer: 'Receita bruta potencial, sem dedução de custos e sem garantia de realização. Risco orientativo, sem avaliação financeira definitiva. Referência de 30 dias; não é projeção para a colheita.',
    }
  }
}
