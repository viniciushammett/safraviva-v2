import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { MARKET_PERIODS } from '@/domain/market-intelligence'
import { domainQueryService, marketIntelligenceService } from '@/services/domain'
import { useDomainStore } from '@/stores/domain/domain-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { useIntelligenceSession } from './session-store'
import { AnalysisResult } from './analysis-result'
import { PlanningForm } from './planning-form'
import { fieldClass, panelClass } from './presentation'

const loadOptions = async () => {
  const data = await domainQueryService.snapshot()
  return { products: data.products.filter((p) => data.marketAnalyses.some((a) => a.productId === p.id)), regions: [...new Set(data.marketAnalyses.map((a) => a.region))].sort() }
}
export function IntelligencePage() {
  const options = useDomainQuery(loadOptions)
  const revision = useDomainStore((s) => s.revision)
  const { filters, analysis } = useIntelligenceSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  async function update() {
    setLoading(true); setError(null)
    useIntelligenceSession.setState({ analysis: null })
    try {
      const result = await marketIntelligenceService.query(filters)
      if (active.current) useIntelligenceSession.setState({ analysis: { result, revision } })
    } catch (cause) {
      if (active.current) setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a análise.')
    } finally { if (active.current) setLoading(false) }
  }
  return <>
    <PageHeader eyebrow="Inteligência comercial" title="Inteligência de Mercado" description="Análise de demanda, tendências e planejamento comercial." />
    {options.error ? <div role="alert" className={panelClass}>{options.error}</div> : options.loading ? <p role="status">Carregando opções de mercado…</p> : options.data && <div className="space-y-6">
      <section className={panelClass} aria-label="Filtros de mercado">
        <form onSubmit={(event) => { event.preventDefault(); void update() }}>
          <fieldset disabled={loading} className="grid items-end gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1.3fr_0.7fr_auto]">
            <label className="min-w-0 text-xs font-medium" htmlFor="market-product">Produto agrícola<select id="market-product" className={fieldClass} value={filters.productId} required onChange={(e) => useIntelligenceSession.setState({ filters: { ...filters, productId: e.target.value }, analysis: null })}><option value="">Selecione um produto</option>{options.data.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium" htmlFor="market-region">Região<select id="market-region" className={fieldClass} value={filters.region} required onChange={(e) => useIntelligenceSession.setState({ filters: { ...filters, region: e.target.value }, analysis: null })}><option value="">Selecione uma região</option>{options.data.regions.map((r) => <option key={r}>{r}</option>)}</select></label>
            <label className="min-w-0 text-xs font-medium" htmlFor="market-period">Período de análise<select id="market-period" className={fieldClass} value={filters.periodDays} onChange={(e) => useIntelligenceSession.setState({ filters: { ...filters, periodDays: Number(e.target.value) }, analysis: null })}>{MARKET_PERIODS.map((p) => <option key={p} value={p}>{p} dias</option>)}</select></label>
            <Button type="submit" disabled={!filters.productId || !filters.region || loading}><RefreshCw size={15} />{loading ? 'Atualizando…' : 'Atualizar análise'}</Button>
          </fieldset>
          <p className="mt-4 text-xs text-muted-foreground">{options.data.products.length === 0 ? 'Não há análises disponíveis no cenário atual.' : 'A disponibilidade depende da combinação de produto, região e período.'}</p>
        </form>
      </section>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {loading ? <p role="status">Consultando o cenário de mercado…</p> : analysis ? <>{analysis.revision !== revision && <p role="status" className="text-sm text-amber-800">O cenário mudou. Atualize a análise para consultar os dados atuais.</p>}<AnalysisResult result={analysis.result} /></> : !error && <div role="status" className={panelClass}><h2 className="font-semibold">Consulte o mercado da sua região</h2><p className="mt-2 text-sm text-muted-foreground">Selecione produto, região e período e atualize a análise para visualizar os indicadores.</p></div>}
      <PlanningForm products={options.data.products} regions={options.data.regions} revision={revision} />
    </div>}
  </>
}
