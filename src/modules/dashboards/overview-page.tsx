import { lazy, Suspense, useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { DASHBOARD_CONFIG, DASHBOARD_PERIODS, type DashboardPeriod } from '@/domain/operational-analytics'
import { dashboardService } from '@/services/domain'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { currency, dateLabel, fieldClass, quantity } from '@/modules/production/presentation'
import { trends } from '@/modules/intelligence/presentation'
import { RecentOrders } from './recent-orders'
const PerformanceChart = lazy(() => import('./performance-chart'))
export function OverviewPage() {
  const workspace = useActiveWorkspace()
  if (!workspace) return null
  return <><PageHeader eyebrow="Visão geral" title={`Olá, ${workspace.user.name.split(' ')[0]}.`} description={workspace.profile === 'producer' ? 'Acompanhe vendas, produção e prioridades da operação.' : 'Acompanhe compras, fornecedores e oportunidades de abastecimento.'} /><OverviewWorkspace key={workspace.id} organizationId={workspace.id} /></>
}
function OverviewWorkspace({ organizationId }: { organizationId: string }) {
  const [period, setPeriod] = useState<DashboardPeriod>(30)
  const load = useCallback(() => dashboardService.overview(organizationId, period), [organizationId, period])
  const { data, loading, error } = useDomainQuery(load)
  return <div className="min-w-0 space-y-5">
    {loading && <p role="status" className="text-sm text-muted-foreground">Carregando indicadores operacionais…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {data && <>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores operacionais">{[
        [data.profile === 'producer' ? 'Vendas realizadas' : 'Compras realizadas', currency(data.indicators.completedAmount), 'Valor bruto dos pedidos entregues, em todo o histórico.'],
        ['Pedidos em andamento', data.indicators.inProgressCount.toString(), 'Confirmados, em preparação ou em transporte.'],
        [data.profile === 'producer' ? 'Pedidos pendentes' : 'Solicitações pendentes', data.indicators.pendingCount.toString(), 'Aguardando confirmação; não reservam estoque.'],
        [data.profile === 'producer' ? 'Produção disponível' : 'Fornecedores ativos', data.profile === 'producer' ? quantity(data.indicators.availableProductionKg ?? 0) : String(data.indicators.activeSuppliers ?? 0), data.profile === 'producer' ? 'Previsão ou colheita, descontados volumes confirmados ou vendidos.' : 'Produtores ativos com oferta publicada e saldo disponível.'],
      ].map(([label, value, hint]) => <div className="rounded-xl border bg-white p-5 shadow-soft" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-3 text-2xl font-semibold text-primary">{value}</dd><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{hint}</p></div>)}</dl>
      <section className="min-w-0 rounded-xl border bg-white p-5 shadow-soft"><div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-semibold">{data.profile === 'producer' ? 'Desempenho de vendas' : 'Desempenho de compras'}</h2><p className="mt-2 text-xs text-muted-foreground">Entregas registradas de {dateLabel(data.series.startDate)} a {dateLabel(data.series.endDate)} · dias em UTC.</p></div><label className="text-xs font-medium">Período do gráfico<select className={fieldClass} value={period} onChange={(e) => setPeriod(Number(e.target.value) as DashboardPeriod)}>{DASHBOARD_PERIODS.map((days) => <option key={days} value={days}>{days} dias</option>)}</select></label></div>
        {data.series.orderCount === 0 ? <div role="status" className="flex h-48 flex-col items-center justify-center rounded-lg bg-background px-5 text-center"><h3 className="text-sm font-semibold">Nenhuma entrega concluída neste período</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">O desempenho comercial será exibido conforme os pedidos forem entregues.</p></div> : <Suspense fallback={<p role="status">Carregando gráfico…</p>}><PerformanceChart series={data.series} producer={data.profile === 'producer'} /></Suspense>}
        {data.series.missingDeliveryDate > 0 && <p className="mt-3 text-xs text-muted-foreground">{data.series.missingDeliveryDate} pedidos entregues sem data de entrega verificável ficaram fora do gráfico.</p>}
      </section>
      <RecentOrders orders={data.recentOrders} producer={data.profile === 'producer'} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {data.profile === 'producer' ? <section className="rounded-xl border bg-white p-5 shadow-soft"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Oportunidades de mercado</h2><Link className="text-xs text-primary underline" to="/producer/intelligence">Consultar inteligência</Link></div><p className="mt-2 text-xs text-muted-foreground">Análises de referência para produtos da organização.</p>{data.recommendations.length ? <ul className="mt-4 divide-y">{data.recommendations.map((r) => <li key={r.analysis.id} className="py-4"><div className="flex flex-wrap justify-between gap-3"><h3 className="text-sm font-semibold">{r.product.name}</h3><StatusBadge>{trends[r.analysis.trend]}</StatusBadge></div><p className="mt-2 text-xs text-muted-foreground">{r.analysis.region} · Referência {dateLabel(r.analysis.calculatedAt)}</p><p className="mt-3 text-sm leading-6">{r.guidance.recommendation}</p><details className="mt-3 text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer">Metodologia e limitações</summary><p className="mt-2">{r.analysis.methodology}</p></details></li>)}</ul> : <p role="status" className="mt-5 text-sm text-muted-foreground">Sem análises disponíveis para os produtos cadastrados.</p>}</section> : <section className="min-w-0 rounded-xl border bg-white p-5 shadow-soft xl:col-span-2"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Oportunidades de abastecimento</h2><Link className="text-xs text-primary underline" to="/buyer/marketplace">Consultar mercado</Link></div><p className="mt-2 text-xs text-muted-foreground">Ofertas disponíveis, priorizadas por município e estado da organização.</p>{data.supplyOpportunities.length ? <ul className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">{data.supplyOpportunities.map((o) => <li key={o.id} className="min-w-0 break-words border-t py-4"><Link className="text-sm font-semibold text-primary underline" to={`/buyer/marketplace?offer=${encodeURIComponent(o.id)}`}>{o.productName} · {o.producerName}</Link><p className="mt-2 text-xs text-muted-foreground">{o.region} · {quantity(o.availableQuantityKg)} · {currency(o.pricePerKg)}/kg</p></li>)}</ul> : <p role="status" className="mt-5 text-sm text-muted-foreground">Nenhuma oferta publicada com saldo disponível.</p>}</section>}
        {data.alerts && <section className="rounded-xl border bg-white p-5 shadow-soft"><h2 className="font-semibold">Alertas operacionais</h2><ul className="mt-4 divide-y text-sm">{[
          [data.alerts.awaitingConfirmation.length, 'pedidos aguardando confirmação', '/producer/orders'],
          [data.alerts.approachingAvailability.length, `ofertas com disponibilidade nos próximos ${DASHBOARD_CONFIG.availabilityAlertDays} dias`, '/producer/production'],
          [data.alerts.exhaustedOffers.length, 'ofertas publicadas esgotadas', '/producer/production'],
          [data.alerts.logisticsOpportunities, 'oportunidades de consolidação logística', '/producer/logistics'],
        ].filter(([count]) => Number(count) > 0).map(([count, label, path]) => <li className="py-4" key={String(path) + String(label)}><Link className="text-primary underline" to={String(path)}>{count} {label}</Link></li>)}</ul>{!data.alerts.awaitingConfirmation.length && !data.alerts.approachingAvailability.length && !data.alerts.exhaustedOffers.length && !data.alerts.logisticsOpportunities && <p role="status" className="mt-4 text-sm text-muted-foreground">Nenhum alerta operacional nos dados atuais.</p>}</section>}
      </div>
      <p className="text-[11px] leading-5 text-muted-foreground">Indicadores gerais consideram todo o histórico; o filtro de período altera somente o gráfico. Valores são brutos e não representam lucro ou pagamento recebido. Atualizado em {dateLabel(data.referenceDate)}.</p>
    </>}
  </div>
}
