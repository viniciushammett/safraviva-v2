import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { EditorPanel } from '@/modules/production/editor-panel'
import { currency, dateLabel, quantity } from '@/modules/production/presentation'
import { logisticsStatuses, orderActionLabel, orderStatuses, timestampLabel, type OrderView } from '@/modules/commercial/presentation'
import type { OrderAction } from '@/domain/order-actions'
import { commercialService } from '@/services/domain'
import { OrderTimeline } from './order-timeline'
export function OrderPanel({ order, organizationId, onClose, onUpdated }: { order: OrderView | null; organizationId: string; onClose: () => void; onUpdated: (message: string) => void }) {
  const [action, setAction] = useState<OrderAction | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function confirm() {
    if (!order || !action || busy) return
    setBusy(true); setError(null)
    try {
      await commercialService[action](organizationId, order.id)
      const feedback = action === 'requestCancellation' && order.status !== 'pending_confirmation' ? 'Cancelamento solicitado. A reserva permanece até aprovação do produtor.' : 'Pedido atualizado com sucesso.'
      setMessage(feedback); onUpdated(feedback)
      setAction(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o pedido.') }
    finally { setBusy(false) }
  }
  return <EditorPanel title="Detalhes do pedido" description={order ? `Pedido ${order.id}` : 'Consulta da organização ativa.'} onClose={onClose} busy={busy}>
    {!order ? <p role="status">Este pedido não está disponível para a organização ativa.</p> : <>
      <StatusBadge active={['confirmed', 'preparing', 'in_transit'].includes(order.status)}>{orderStatuses[order.status]}</StatusBadge>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">{[['Produtor', order.producerName], ['Comprador', order.buyerName], ['Produto', order.productName], ['Quantidade', quantity(order.quantityKg)], ['Preço unitário contratado', currency(order.unitPrice)], ['Valor do pedido', currency(order.totalAmount)], ['Solicitado em', timestampLabel(order.requestedAt)], ['Origem', order.origin], ['Cidade da organização compradora', order.destination], ['Disponibilidade da oferta', `${order.availabilityType === 'future' ? 'Colheita futura' : 'Imediata'} · ${dateLabel(order.availableFrom)}`]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">Endereço de entrega, prazo negociado e condições de pagamento não estão cadastrados neste pedido. A localidade da organização não representa um endereço de entrega confirmado.</p>
      {order.cancellationRequested && <p role="status" className="mt-5 rounded-lg border bg-muted p-3 text-sm">Cancelamento solicitado pelo comprador. A reserva permanece até aprovação do produtor.</p>}
      <div className="mt-5 flex flex-wrap gap-3">{order.actions.map((key) => <Button key={key} variant={key === 'confirmOrder' || key === 'prepareOrder' ? 'default' : 'outline'} onClick={() => { setError(null); setAction(key) }}>{orderActionLabel(key, order)}</Button>)}</div>
      {message && <p role="status" className="mt-4 rounded-lg bg-muted p-3 text-sm text-primary">{message}</p>}
      <section className="mt-7 border-t pt-5" aria-label="Etapa logística"><h3 className="font-semibold">Etapa logística</h3>{order.logistics ? <div className="mt-3 space-y-2 text-sm"><p>Operação: {order.logistics.id}</p><p>Transportador: {order.logistics.partnerName}</p><p>Situação da operação: {logisticsStatuses[order.logistics.status]}</p><p>Modalidade: {order.logistics.transportMode === 'shared' ? 'Compartilhada' : 'Individual'}</p><p className="text-xs text-muted-foreground">Consulta da operação vinculada. Não há rastreamento em tempo real ou previsão de entrega.</p></div> : <p className="mt-3 text-sm text-muted-foreground">Nenhuma operação logística vinculada.</p>}</section>
      <OrderTimeline order={order} />
      {action && <Dialog open onOpenChange={(open) => { if (!open && !busy) setAction(null) }}><DialogContent><DialogTitle className="pr-6 text-lg font-semibold">{orderActionLabel(action, order)}?</DialogTitle><DialogDescription className="mt-3 text-sm leading-6">{action === 'confirmOrder' ? 'O saldo será validado novamente. Aceitar o pedido reserva a quantidade solicitada.' : action === 'requestCancellation' ? order.status === 'pending_confirmation' ? 'O pedido pendente será cancelado e seu histórico será preservado.' : 'Esta ação solicita a aprovação do produtor. A reserva não será liberada agora.' : action === 'approveCancellation' ? 'O pedido será cancelado e sua reserva será liberada. O histórico será preservado.' : action === 'rejectOrder' ? 'O pedido será recusado sem reserva de estoque. Seu histórico será preservado.' : 'O pedido entrará em preparação se a produção já estiver disponível.'}</DialogDescription>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 flex gap-3"><Button disabled={busy} onClick={() => { void confirm() }}>{busy ? 'Atualizando…' : 'Confirmar operação'}</Button><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Voltar</Button></div></DialogContent></Dialog>}
    </>}
  </EditorPanel>
}
