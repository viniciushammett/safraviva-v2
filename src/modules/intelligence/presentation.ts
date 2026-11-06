import type { CommercialRisk, MarketCondition } from '@/domain/market-intelligence'
import type { MarketAnalysis } from '@/types/domain'
export const number = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)
export const money = (value: number | null) => value === null ? 'Indisponível' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
export const percent = (value: number | null) => value === null ? 'Indisponível' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}%`
export const conditions: Record<MarketCondition, string> = { opportunity: 'Oportunidade', balanced: 'Mercado equilibrado', oversupply: 'Excesso de oferta', insufficient_data: 'Dados insuficientes' }
export const risks: Record<CommercialRisk, string> = { low: 'Baixo', moderate: 'Moderado', high: 'Alto', insufficient_data: 'Dados insuficientes' }
export const trends: Record<MarketAnalysis['trend'], string> = { growing: 'Crescente', stable: 'Estável', declining: 'Declinante' }
export const fieldClass = 'mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50'
export const panelClass = 'rounded-xl border bg-white p-5 shadow-soft sm:p-6'
