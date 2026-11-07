import { useSearchParams } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { domainQueryService } from '@/services/domain'
import { cellClass, currency, fieldClass, quantity } from '@/modules/production/presentation'
import { orderStatuses, timestampLabel } from '@/modules/commercial/presentation'
import { OrderPanel } from './order-panel'
export function OrdersPage() {
  const workspace = useActiveWorkspace()
  const [params] = useSearchParams()
  return <><PageHeader eyebrow="Operação comercial" title={workspace?.profile === 'producer' ? 'Pedidos e Vendas' : 'Pedidos e Compras'} description="Acompanhe solicitações, confirmações e o histórico das suas relações comerciais." />{workspace ? <OrdersWorkspace key={workspace.id} organizationId={workspace.id} producer={workspace.profile === 'producer'} initialOrder={params.get('order')} /> : <p role="status">Selecione uma organização para consultar seus pedidos.</p>}</>
}
function OrdersWorkspace({ organizationId, producer, initialOrder }: { organizationId: string; producer: boolean; initialOrder: string | null }) {
  const load = useCallback(() => domainQueryService.ordersWorkspace(organizationId), [organizationId])
  const { data, loading, error } = useDomainQuery(load, { keepPreviousData: true })
  const [selected, setSelected] = useState<string | null>(initialOrder)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState('')
  const orders = data?.filter((o) => `${o.id} ${o.productName} ${producer ? o.buyerName : o.producerName}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!status || o.status === status)) ?? []
  return <>
    {message && <p role="status" className="mb-5 rounded-lg border bg-muted p-4 text-sm text-primary">{message}</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border bg-white shadow-soft" aria-label="Pedidos da organização">
      <div className="grid gap-4 border-b p-5 sm:grid-cols-[1fr_240px]"><label className="text-xs font-medium">Pesquisar pedidos<input className={fieldClass} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pedido, produto ou organização" /></label><label className="text-xs font-medium">Status do pedido<select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(orderStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {loading && <p role="status" className="p-5 text-sm text-muted-foreground">Atualizando pedidos…</p>}
      {data && <><p className="border-b px-5 py-3 text-xs text-muted-foreground">{orders.length} de {data.length} pedidos nesta organização.</p><div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">{producer ? 'Vendas da organização' : 'Compras da organização'}</caption><thead className="bg-background text-muted-foreground"><tr>{['Pedido', producer ? 'Comprador' : 'Fornecedor', 'Produto', 'Quantidade', 'Valor', 'Data', 'Status', 'Ações'].map((h) => <th scope="col" key={h} className={`${cellClass} font-medium`}>{h}</th>)}</tr></thead><tbody className="divide-y">{orders.map((order) => <tr key={order.id}><td className={cellClass}>{order.id}</td><td className={cellClass}>{producer ? order.buyerName : order.producerName}</td><td className={cellClass}>{order.productName}</td><td className={cellClass}>{quantity(order.quantityKg)}</td><td className={cellClass}>{currency(order.totalAmount)}</td><td className={cellClass}>{timestampLabel(order.requestedAt)}</td><td className={cellClass}><StatusBadge active={['confirmed', 'preparing', 'in_transit'].includes(order.status)}>{orderStatuses[order.status]}</StatusBadge>{order.cancellationRequested && <span className="mt-1 block text-[10px] text-muted-foreground">Cancelamento solicitado</span>}</td><td className={cellClass}><Button variant="outline" size="sm" onClick={() => setSelected(order.id)}>Detalhes e ações</Button></td></tr>)}</tbody></table></div>{orders.length === 0 && <p role="status" className="p-10 text-center text-sm text-muted-foreground">Nenhum pedido encontrado para os filtros selecionados.</p>}</>}
    </section>
    {selected && data && <OrderPanel key={selected} order={data.find((o) => o.id === selected) ?? null} organizationId={organizationId} onClose={() => setSelected(null)} onUpdated={setMessage} />}
  </>
}
