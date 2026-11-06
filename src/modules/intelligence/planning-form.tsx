import { PlanningAction } from '@/modules/production/planning-action'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { commercialPlanSchema, type CommercialPlanInput } from '@/services/domain/market-intelligence-service'
import { marketIntelligenceService } from '@/services/domain'
import type { Product } from '@/types/domain'
import { useIntelligenceSession } from './session-store'
import { conditions, fieldClass, money, number, panelClass, percent, risks } from './presentation'

export function PlanningForm({ products, regions, revision }: { products: Product[]; regions: string[]; revision: number }) {
  const simulation = useIntelligenceSession((s) => s.simulation)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const { register, handleSubmit, subscribe, formState: { errors, isSubmitting } } = useForm<CommercialPlanInput>({ resolver: zodResolver(commercialPlanSchema), defaultValues: { productId: '', region: '', expectedHarvestDate: '', ...useIntelligenceSession.getState().plan } })
  useEffect(() => {
    return subscribe({ formState: { values: true }, callback: ({ values }) => useIntelligenceSession.setState({ plan: values }) })
  }, [subscribe])
  const submit = async (input: CommercialPlanInput) => {
    setError(null)
    try {
      const result = await marketIntelligenceService.simulate(input)
      if (active.current) useIntelligenceSession.setState({ simulation: { result, input, revision } })
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Não foi possível simular o planejamento.')
    }
  }
  return <section className={panelClass} aria-labelledby="planning-heading">
    <h2 id="planning-heading" className="text-lg font-semibold">Planejamento comercial</h2><p className="mt-2 text-sm text-muted-foreground">Simule um plano com a referência de 30 dias. A data de colheita é uma informação do planejamento; não há projeção para essa data.</p>
    <form onSubmit={(event) => { void handleSubmit(submit)(event) }} noValidate className="mt-6">
      <fieldset disabled={isSubmitting} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="min-w-0 text-xs font-medium" htmlFor="plan-product">Produto do planejamento<select id="plan-product" className={fieldClass} {...register('productId')} aria-invalid={!!errors.productId} aria-describedby={errors.productId ? 'plan-product-error' : undefined}><option value="">Selecione um produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>{errors.productId && <span id="plan-product-error" role="alert" className="mt-2 block text-red-700">Selecione um produto.</span>}</label>
        <label className="min-w-0 text-xs font-medium" htmlFor="plan-region">Região do planejamento<select id="plan-region" className={fieldClass} {...register('region')} aria-invalid={!!errors.region} aria-describedby={errors.region ? 'plan-region-error' : undefined}><option value="">Selecione uma região</option>{regions.map((region) => <option key={region}>{region}</option>)}</select>{errors.region && <span id="plan-region-error" role="alert" className="mt-2 block text-red-700">Selecione uma região.</span>}</label>
        <label className="min-w-0 text-xs font-medium" htmlFor="plan-quantity">Quantidade planejada (kg)<input id="plan-quantity" type="number" step="0.001" className={fieldClass} {...register('plannedQuantityKg', { valueAsNumber: true })} aria-invalid={!!errors.plannedQuantityKg} aria-describedby={errors.plannedQuantityKg ? 'plan-quantity-error' : undefined} />{errors.plannedQuantityKg && <span id="plan-quantity-error" role="alert" className="mt-2 block text-red-700">Informe uma quantidade positiva até 1 bilhão, com até três casas decimais.</span>}</label>
        <label className="min-w-0 text-xs font-medium" htmlFor="plan-date">Data estimada de colheita<input id="plan-date" type="date" className={fieldClass} {...register('expectedHarvestDate')} aria-invalid={!!errors.expectedHarvestDate} aria-describedby={errors.expectedHarvestDate ? 'plan-date-error' : undefined} />{errors.expectedHarvestDate && <span id="plan-date-error" role="alert" className="mt-2 block text-red-700">Informe uma data de colheita válida.</span>}</label>
        <label className="min-w-0 text-xs font-medium" htmlFor="plan-price">Preço desejado (R$/kg)<input id="plan-price" type="number" step="0.01" className={fieldClass} {...register('desiredPricePerKg', { valueAsNumber: true })} aria-invalid={!!errors.desiredPricePerKg} aria-describedby={errors.desiredPricePerKg ? 'plan-price-error' : undefined} />{errors.desiredPricePerKg && <span id="plan-price-error" role="alert" className="mt-2 block text-red-700">Informe um preço positivo até 1 bilhão, com até duas casas decimais.</span>}</label>
        <div className="flex items-end"><Button type="submit">{isSubmitting ? 'Simulando…' : 'Simular planejamento'}</Button></div>
      </fieldset>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </form>
    {simulation && <section aria-label="Resultado da simulação" aria-live="polite" className="mt-6 rounded-lg border border-primary/20 bg-background p-5">
      <h3 className="font-semibold">Simulação concluída</h3><p className="mt-2 text-xs text-muted-foreground">Resultado do plano enviado: {products.find((p) => p.id === simulation.input.productId)?.name ?? simulation.input.productId} · {simulation.input.region} · {number(simulation.input.plannedQuantityKg)} kg · Colheita {simulation.input.expectedHarvestDate.split('-').reverse().join('/')} · Preço {money(simulation.input.desiredPricePerKg)}/kg. Alterações no formulário exigem nova simulação.</p>
      {simulation.revision !== revision && <p role="status" className="mt-3 text-sm text-amber-800">O cenário foi atualizado. Simule novamente para consultar a referência atual.</p>}
      {simulation.result.market.status === 'unavailable' && <p role="status" className="mt-3 text-sm">Análise indisponível para este plano. A receita abaixo é apenas o cálculo da quantidade pelo preço informado.</p>}
      <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[
        ['Receita bruta potencial', money(simulation.result.potentialGrossRevenue)], ['Preço de referência (R$/kg)', money(simulation.result.referencePricePerKg)], ['Diferença percentual de preço', percent(simulation.result.priceDifferencePercent)], ['Condição de mercado', conditions[simulation.result.condition]], ['Risco comercial orientativo', risks[simulation.result.risk]],
      ].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold text-primary">{value}</dd></div>)}</dl>
      <p className="mt-5 text-sm leading-6">{simulation.result.recommendation}</p>
      {simulation.result.market.status === 'available' && <details className="mt-4 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer">Análise baseada em cenário de referência · 30 dias · metodologia</summary><p className="mt-2">Referência: {new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(simulation.result.market.analysis.calculatedAt))}. {simulation.result.market.analysis.methodology}</p></details>}
      <p className="mt-4 text-xs leading-5 text-muted-foreground">{simulation.result.disclaimer}</p>
      <PlanningAction />
    </section>}
  </section>
}
