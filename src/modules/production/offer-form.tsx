import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { createOfferSchema } from '@/domain/schemas'
import { commercialService } from '@/services/domain'
import type { CreateOfferInput } from '@/services/domain/commercial-service'
import type { Offer } from '@/types/domain'
import { EditorPanel } from './editor-panel'
import { fieldClass, quantity, type ProducerWorkspace } from './presentation'
export function OfferForm({ organizationId, data, offer, initialProductionId, desiredPrice, onClose, onSaved }: {
  organizationId: string; data: ProducerWorkspace; offer?: Offer; initialProductionId?: string; desiredPrice?: number; onClose: () => void; onSaved: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const initialProduction = data.productions.find((p) => p.id === (offer?.productionId ?? initialProductionId))
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateOfferInput>({ resolver: zodResolver(createOfferSchema), defaultValues: offer ? { productionId: offer.productionId, quantityKg: offer.quantityKg, pricePerKg: offer.pricePerKg, availabilityType: offer.availabilityType, availableFrom: offer.availableFrom } : { productionId: initialProductionId ?? '', pricePerKg: desiredPrice, availabilityType: initialProduction?.status === 'harvested' ? 'immediate' : 'future', availableFrom: initialProduction?.expectedHarvestDate ?? '' } })
  async function save(input: CreateOfferInput) {
    setError(null)
    try {
      const { productionId, ...changes } = input
      if (offer) await commercialService.editOffer(organizationId, offer.id, changes)
      else await commercialService.createOffer(organizationId, { productionId, ...changes })
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a oferta.') }
  }
  return <EditorPanel title={offer ? 'Editar oferta' : 'Nova oferta comercial'} description="A oferta é salva como rascunho. Publicação e alterações de saldo são validadas pelo serviço comercial." onClose={onClose} busy={isSubmitting}>
    <form onSubmit={(event) => { void handleSubmit(save)(event) }} noValidate><fieldset disabled={isSubmitting} className="space-y-4">
      <label className="block text-xs font-medium">Produção vinculada<select className={fieldClass} {...register('productionId')} disabled={!!offer}><option value="">Selecione uma produção</option>{data.productions.filter((p) => p.status !== 'finished' || p.id === offer?.productionId).map((p) => <option key={p.id} value={p.id}>{p.productName} · {p.id}</option>)}</select></label>
      {initialProduction && <p className="text-xs text-muted-foreground">Volume comercializável: {quantity(initialProduction.commercialVolumeKg)} · Vinculado: {quantity(initialProduction.allocatedQuantityKg)}</p>}
      <label className="block text-xs font-medium">Quantidade anunciada (kg)<input type="number" step="0.001" className={fieldClass} {...register('quantityKg', { valueAsNumber: true })} /></label>
      <label className="block text-xs font-medium">Preço por kg (R$)<input type="number" step="0.01" className={fieldClass} {...register('pricePerKg', { valueAsNumber: true })} /></label>
      <label className="block text-xs font-medium">Tipo de disponibilidade<select className={fieldClass} {...register('availabilityType')}><option value="immediate">Imediata — produção colhida</option><option value="future">Colheita futura</option></select></label>
      <label className="block text-xs font-medium">Data de disponibilidade<input type="date" className={fieldClass} {...register('availableFrom')} /></label>
      <p className="text-xs leading-5 text-muted-foreground">Disponibilidade imediata exige produção colhida e data até hoje. Colheita futura exige data posterior a hoje e igual ou posterior à colheita prevista.</p>
      {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-red-700">Revise a produção, quantidade positiva, preço não negativo e data válida. Use até três casas decimais para kg e duas para preços.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3 border-t pt-5"><Button type="submit">{isSubmitting ? 'Salvando…' : 'Confirmar oferta'}</Button><Button variant="outline" type="button" onClick={onClose}>Cancelar</Button></div>
    </fieldset></form>
  </EditorPanel>
}
