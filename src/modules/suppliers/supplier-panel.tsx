import { Link } from 'react-router-dom'
import { EditorPanel } from '@/modules/production/editor-panel'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { currency, quantity } from '@/modules/production/presentation'
import { logisticsReference } from '@/modules/logistics/references'
import type { DomainQueryService } from '@/services/domain/query-service'
export type SupplierView = Awaited<ReturnType<DomainQueryService['suppliers']>>[number]
export function SupplierPanel({ supplier, favorite, favoritesAvailable, busy, feedback, error, onFavorite, onClose }: { supplier: SupplierView; favorite: boolean; favoritesAvailable: boolean; busy: boolean; feedback: string; error: string; onFavorite: () => void; onClose: () => void }) {
  return <EditorPanel title="Perfil do fornecedor" description={supplier.name} onClose={onClose} busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><StatusBadge active={supplier.active}>{supplier.active ? 'Produtor ativo' : 'Produtor inativo'}</StatusBadge><Button variant="outline" aria-pressed={favoritesAvailable ? favorite : undefined} disabled={busy || !favoritesAvailable} onClick={onFavorite}>{!favoritesAvailable ? 'Favoritos indisponíveis' : favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</Button></div>
    {feedback && <p role="status" className="mt-4 text-sm text-primary">{feedback}</p>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <dl className="mt-5 space-y-4"><div><dt className="text-xs text-muted-foreground">Localidade cadastrada</dt><dd className="mt-1 text-sm">{supplier.city}/{supplier.state}</dd></div><div><dt className="text-xs text-muted-foreground">Produtos nas ofertas ou no histórico concluído</dt><dd className="mt-1 text-sm">{supplier.products.map((p) => p.name).join(', ') || 'Sem produtos comerciais disponíveis.'}</dd></div><div><dt className="text-xs text-muted-foreground">Compras concluídas por sua organização</dt><dd className="mt-1 text-lg font-semibold text-primary">{currency(supplier.completedAmount)}</dd></div></dl>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">A localidade cadastral não define cobertura de entrega. Valores consideram somente seus pedidos entregues, sem pedidos de outros compradores.</p>
    <section className="mt-6 border-t pt-5"><h3 className="font-semibold">Ofertas publicadas com saldo</h3>{supplier.offers.length ? <ul className="mt-3 divide-y">{supplier.offers.map((offer) => <li key={offer.id} className="py-3 text-sm"><Link className="font-medium text-primary underline" to={`/buyer/marketplace?offer=${encodeURIComponent(offer.id)}`}>{offer.productName}</Link><p className="mt-1 text-xs text-muted-foreground">{quantity(offer.availableQuantityKg)} · {currency(offer.pricePerKg)}/kg</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Nenhuma oferta publicada com saldo disponível.</p>}</section>
    <section className="mt-6 border-t pt-5"><h3 className="font-semibold">Histórico de pedidos concluídos</h3>{supplier.completedOrders.length ? <ul className="mt-3 divide-y">{supplier.completedOrders.map((order) => <li className="py-3 text-sm" key={order.id}><Link className="font-medium text-primary underline" title={order.id} to={`/buyer/orders?order=${encodeURIComponent(order.id)}`}>{logisticsReference(order.id)}</Link><p className="mt-1 text-xs text-muted-foreground">{order.productName} · {quantity(order.quantityKg)} · {currency(order.totalAmount)}</p></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Sua organização ainda não tem pedidos entregues por este fornecedor.</p>}</section>
    <Button asChild variant="outline" className="mt-6"><Link to={`/buyer/marketplace?producer=${encodeURIComponent(supplier.id)}`}>Consultar ofertas no mercado</Link></Button>
  </EditorPanel>
}
