import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestOrderSchema } from '@/domain/schemas'
import { orderTotal } from '@/domain/calculations'
import { commercialService } from '@/services/domain'
import { Button } from '@/components/ui/button'
import { EditorPanel } from '@/modules/production/editor-panel'
import { currency, dateLabel, fieldClass, quantity } from '@/modules/production/presentation'
import type { MarketOffer } from '@/modules/commercial/presentation'
import type { Order } from '@/types/domain'
const quantitySchema = requestOrderSchema.pick({ quantityKg: true })
export function OfferPanel({ offer, organizationId, onClose, onRequested }: { offer: MarketOffer | null; organizationId: string; onClose: () => void; onRequested: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<{ quantityKg: number; key: string } | null>(null)
  const [created, setCreated] = useState<Order | null>(null)
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<{ quantityKg: number }>({ resolver: zodResolver(quantitySchema) })
  const desired = useWatch({ control, name: 'quantityKg' })
  const valid = quantitySchema.safeParse({ quantityKg: desired })
  async function submit(input: { quantityKg: number }) {
    if (!offer || created) return
    setError(null)
    const request = receipt?.quantityKg === input.quantityKg ? receipt : { quantityKg: input.quantityKg, key: crypto.randomUUID() }
    setReceipt(request)
    try {
      const order = await commercialService.requestOrder(organizationId, { offerId: offer.id, quantityKg: input.quantityKg, idempotencyKey: request.key })
      setCreated(order); onRequested(order.id)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível solicitar a compra.') }
  }
  return <EditorPanel title="Detalhes da oferta" description="Consulte as condições e envie sua solicitação ao produtor." onClose={onClose} busy={isSubmitting}>
    {created ? <div role="status"><h2 className="font-semibold text-primary">Solicitação enviada</h2><p className="mt-3 text-sm leading-6">Pedido {created.id} aguardando confirmação do produtor. Nenhum estoque foi reservado.</p><p className="mt-3 text-sm">Total registrado: {currency(created.totalAmount)}</p><Button asChild className="mt-5"><Link to="/buyer/orders">Ver Pedidos e Compras</Link></Button></div> : !offer ? <p role="status">Esta oferta não está mais disponível. Consulte outra oferta no mercado.</p> : <>
      <dl className="grid gap-4 sm:grid-cols-2">{[['Produtor', offer.producerName], ['Origem', offer.region], ['Produto', offer.productName], ['Categoria', offer.category], ['Quantidade disponível', quantity(offer.availableQuantityKg)], ['Preço por kg', currency(offer.pricePerKg)], ['Disponibilidade', offer.availabilityType === 'future' ? 'Colheita futura' : 'Imediata'], ['Data de disponibilidade', dateLabel(offer.availableFrom)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{value}</dd></div>)}</dl>
      <p className="mt-5 text-xs leading-5 text-muted-foreground">Pagamento, frete e endereço de entrega não estão definidos nesta oferta. A solicitação não reserva estoque; a reserva depende da confirmação do produtor. Preço e saldo são consultados novamente ao solicitar.</p>
      <form noValidate className="mt-6" onSubmit={(event) => { void handleSubmit(submit)(event) }}><fieldset disabled={isSubmitting}>
        <label className="block text-xs font-medium">Quantidade desejada (kg)<input type="number" step="0.001" className={fieldClass} {...register('quantityKg', { valueAsNumber: true })} aria-invalid={!!errors.quantityKg} aria-describedby="request-quantity-error" /></label>
        {errors.quantityKg && <p id="request-quantity-error" role="alert" className="mt-2 text-sm text-red-700">Informe uma quantidade positiva, com até três casas decimais e limite de 1 bilhão de kg.</p>}
        <p className="mt-4 text-sm">Total estimado: <strong>{valid.success ? currency(orderTotal(valid.data.quantityKg, offer.pricePerKg)) : 'Informe a quantidade'}</strong></p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <Button type="submit" className="mt-5">{isSubmitting ? 'Enviando…' : 'Confirmar solicitação'}</Button>
      </fieldset></form>
    </>}
  </EditorPanel>
}
