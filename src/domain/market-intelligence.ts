import { orderTotal, roundKg } from '@/domain/calculations'
import { invariant } from '@/domain/errors'
import type { MarketAnalysis } from '@/types/domain'

export const MARKET_PERIODS = [7, 15, 30] as const
export type MarketPeriod = typeof MARKET_PERIODS[number]
export type MarketCondition = 'opportunity' | 'balanced' | 'oversupply' | 'insufficient_data'
export type CommercialRisk = 'low' | 'moderate' | 'high' | 'insufficient_data'
export interface RecommendationConfig {
  readonly opportunityRatio: number
  readonly oversupplyRatio: number
  readonly highPricePremiumPercent: number
}
/** Inclusive boundaries. A ratio in (0.9, 1.1) is balanced. */
export const RECOMMENDATION_CONFIG: Readonly<RecommendationConfig> = Object.freeze({ opportunityRatio: 1.1, oversupplyRatio: 0.9, highPricePremiumPercent: 10 })

function nonnegative(value: number) {
  invariant(Number.isFinite(value) && value >= 0, 'VALIDATION', 'Valor deve ser finito e não negativo.')
}
function finite(value: number) {
  invariant(Number.isFinite(value), 'VALIDATION', 'Resultado fora do intervalo numérico suportado.')
  return value
}
export function demandGapKg(demand: number, supply: number) {
  nonnegative(demand); nonnegative(supply)
  return finite(roundKg(demand - supply))
}
/** Null means undefined ratio, including 0/0; never Infinity. */
export function demandSupplyRatio(demand: number, supply: number): number | null {
  nonnegative(demand); nonnegative(supply)
  return supply === 0 ? null : finite(demand / supply)
}
export function priceDifferencePercent(desired: number, reference: number) {
  nonnegative(desired); nonnegative(reference)
  invariant(reference > 0, 'VALIDATION', 'Preço de referência deve ser maior que zero.')
  return finite(((desired - reference) / reference) * 100)
}
/** Same gram/centavo convention as commercial orders; gross revenue, not profit. */
export function potentialGrossRevenue(quantity: number, price: number) {
  nonnegative(quantity); nonnegative(price)
  invariant(quantity > 0 && price > 0, 'VALIDATION', 'Quantidade e preço devem ser positivos.')
  return finite(orderTotal(quantity, price))
}
export function recommendMarket(analysis: MarketAnalysis | null, desiredPrice?: number, config: RecommendationConfig = RECOMMENDATION_CONFIG): { condition: MarketCondition; risk: CommercialRisk; recommendation: string } {
  invariant(Number.isFinite(config.opportunityRatio) && config.opportunityRatio > 1 && Number.isFinite(config.oversupplyRatio) && config.oversupplyRatio > 0 && config.oversupplyRatio < 1 && Number.isFinite(config.highPricePremiumPercent) && config.highPricePremiumPercent > 0, 'VALIDATION', 'Parâmetros de recomendação inválidos.')
  if (desiredPrice !== undefined) { nonnegative(desiredPrice); invariant(desiredPrice > 0, 'VALIDATION', 'Preço deve ser positivo.') }
  if (!analysis || !MARKET_PERIODS.includes(analysis.periodDays as MarketPeriod) || !Number.isFinite(analysis.referencePricePerKg) || analysis.referencePricePerKg <= 0 || !Number.isFinite(analysis.estimatedDemandKg) || analysis.estimatedDemandKg < 0 || !Number.isFinite(analysis.estimatedSupplyKg) || analysis.estimatedSupplyKg < 0 || (analysis.estimatedDemandKg === 0 && analysis.estimatedSupplyKg === 0)) {
    return { condition: 'insufficient_data', risk: 'insufficient_data', recommendation: 'Dados insuficientes para orientação comercial.' }
  }
  const ratio = demandSupplyRatio(analysis.estimatedDemandKg, analysis.estimatedSupplyKg)
  const excessDemand = ratio === null || ratio >= config.opportunityRatio
  const oversupply = ratio !== null && ratio <= config.oversupplyRatio
  const condition: MarketCondition = oversupply ? 'oversupply' : excessDemand && analysis.trend !== 'declining' ? 'opportunity' : 'balanced'
  const premium = desiredPrice === undefined ? 0 : priceDifferencePercent(desiredPrice, analysis.referencePricePerKg)
  const risk: CommercialRisk = oversupply || premium >= config.highPricePremiumPercent ? 'high' : premium > 0 || analysis.trend === 'declining' || condition !== 'opportunity' ? 'moderate' : 'low'
  const guidance = condition === 'opportunity' ? 'Considere negociar o volume com compradores regionais.' : condition === 'oversupply' ? 'Considere escalonar a comercialização e diversificar compradores.' : 'Considere negociar gradualmente e acompanhar a demanda.'
  return { condition, risk, recommendation: `${guidance} Horizonte analisado: ${analysis.periodDays} dias. ${premium > 0 ? 'Avalie a aceitação do preço acima da referência. ' : ''}Orientação determinística; receita e comercialização dependem das condições efetivas.` }
}
