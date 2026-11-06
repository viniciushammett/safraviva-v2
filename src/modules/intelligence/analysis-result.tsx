import type { MarketQueryResult } from '@/services/domain/market-intelligence-service'
import { lazy, Suspense } from 'react'
const MarketChart = lazy(() => import('./market-chart').then((module) => ({ default: module.MarketChart })))
import { conditions, money, number, panelClass, percent, trends } from './presentation'
export function AnalysisResult({ result }: { result: MarketQueryResult }) {
  if (result.status === 'unavailable') return <div role="status" className={panelClass}><h2 className="font-semibold">Análise indisponível</h2><p className="mt-2 text-sm text-muted-foreground">Não há dados suficientes para esta combinação de produto, região e período. Selecione outra combinação.</p></div>
  const { analysis, indicators, guidance, product } = result
  return <div className="space-y-6">
    <p className="text-sm text-muted-foreground">{product.name} · {analysis.region} · {analysis.periodDays} dias</p>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ['Demanda estimada', `${number(analysis.estimatedDemandKg)} kg`], ['Oferta regional estimada', `${number(analysis.estimatedSupplyKg)} kg`], ['Preço de referência', `${money(analysis.referencePricePerKg)}/kg`], ['Tendência de mercado', trends[analysis.trend]],
    ].map(([label, value]) => <div key={label} className={panelClass}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-3 text-2xl font-semibold tracking-tight text-primary">{value}</dd></div>)}</dl>
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className={`${panelClass} min-w-0`}><h2 className="font-semibold">Demanda e oferta estimadas</h2><p className="mt-1 text-xs text-muted-foreground">Comparativo regional · {analysis.periodDays} dias</p><Suspense fallback={<p role="status" className="py-10 text-sm text-muted-foreground">Carregando gráfico…</p>}><MarketChart analysis={analysis} /></Suspense></section>
      <section className={panelClass}><p className="text-xs font-semibold uppercase tracking-wider text-accent">Recomendação comercial</p><h2 className="mt-3 text-lg font-semibold">{conditions[guidance.condition]}</h2><p className="mt-4 text-sm leading-6">{guidance.recommendation}</p><dl className="mt-5 space-y-3 border-t pt-4 text-sm"><div><dt className="text-muted-foreground">Diferença entre demanda e oferta</dt><dd className="font-medium">{number(indicators.demandGapKg)} kg</dd></div><div><dt className="text-muted-foreground">Demanda em relação à oferta</dt><dd className="font-medium">{percent(indicators.demandSupplyPercent)}</dd></div><div><dt className="text-muted-foreground">Tendência no período</dt><dd className="font-medium">{trends[analysis.trend]}</dd></div></dl></section>
    </div>
    <details className="rounded-lg border bg-muted/50 px-5 py-4 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer font-medium text-primary">Análise baseada em cenário de referência · metodologia</summary><p className="mt-3">Referência: {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(analysis.calculatedAt))} · Período: {analysis.periodDays} dias.</p><p className="mt-2">{analysis.methodology}</p><p className="mt-2">Orientação por regras determinísticas. A análise não representa necessariamente o mercado na data de colheita.</p></details>
  </div>
}
