import { eventLabels, orderStatuses, timestampLabel, type OrderView } from '@/modules/commercial/presentation'
export function OrderTimeline({ order }: { order: OrderView }) {
  const currentEvent = order.history.slice().reverse().find((event) => event.metadata.toStatus === order.status)
  return <section className="mt-7 border-t pt-5" aria-label="Histórico operacional"><h3 className="font-semibold">Histórico operacional</h3><p className="mt-2 text-xs text-muted-foreground">Etapa atual: {orderStatuses[order.status]}. Somente eventos registrados são apresentados.</p>
    {order.history.length ? <ol className="mt-5 space-y-5 border-l border-border pl-5">{order.history.map((event) => <li key={event.id} aria-current={event.id === currentEvent?.id ? 'step' : undefined} className={`relative text-sm ${event.id === currentEvent?.id ? 'font-medium text-primary' : 'text-muted-foreground'}`}><span aria-hidden="true" className={`absolute -left-[25px] top-1 size-2 rounded-full ${event.id === currentEvent?.id ? 'bg-accent' : 'bg-border'}`} /><p>{eventLabels[event.eventType] ?? event.eventType}</p><time dateTime={event.timestamp} className="mt-1 block text-xs font-normal text-muted-foreground">{timestampLabel(event.timestamp)}</time></li>)}</ol> : <p className="mt-4 text-sm text-muted-foreground">Histórico não disponível.</p>}
  </section>
}
