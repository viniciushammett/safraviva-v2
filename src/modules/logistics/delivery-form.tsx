import { logisticsReference } from './references'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { logisticsService } from '@/services/domain'
import { deliveryInformationSchema } from '@/domain/logistics-schemas'
import type { DeliveryInformation } from '@/types/logistics'
import { EditorPanel } from '@/modules/production/editor-panel'
import { fieldClass, quantity } from '@/modules/production/presentation'
import type { DeliveryRow } from './types'
export function DeliveryForm({ order, organizationId, onClose, onSaved }: { order: DeliveryRow; organizationId: string; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState('')
  const [coordinates, setCoordinates] = useState(() => ({ originLat: order.delivery?.origin.coordinates?.latitude.toString() ?? '', originLng: order.delivery?.origin.coordinates?.longitude.toString() ?? '', destinationLat: order.delivery?.destination.coordinates?.latitude.toString() ?? '', destinationLng: order.delivery?.destination.coordinates?.longitude.toString() ?? '', originSource: order.delivery?.origin.coordinates?.source ?? 'provided_reference', destinationSource: order.delivery?.destination.coordinates?.source ?? 'provided_reference' }))
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DeliveryInformation>({ resolver: zodResolver(deliveryInformationSchema), defaultValues: order.delivery ?? { origin: { label: '', city: '', state: 'SP' }, destination: { label: '', city: '', state: 'SP' }, windowStart: '', windowEnd: '', weightKg: order.quantityKg, referenceDistanceKm: undefined, restrictions: ['ambient'] } })
  async function save(values: DeliveryInformation) {
    setError('')
    const point = (lat: string, lng: string, source: 'synthetic' | 'provided_reference') => lat === '' && lng === '' ? undefined : { latitude: lat === '' ? NaN : Number(lat), longitude: lng === '' ? NaN : Number(lng), source }
    const parsed = deliveryInformationSchema.safeParse({ ...values, origin: { ...values.origin, coordinates: point(coordinates.originLat, coordinates.originLng, coordinates.originSource) }, destination: { ...values.destination, coordinates: point(coordinates.destinationLat, coordinates.destinationLng, coordinates.destinationSource) } })
    if (!parsed.success) { setError('Revise as coordenadas: latitude entre -90 e 90, longitude entre -180 e 180; informe o par completo ou deixe ambos vazios.'); return }
    try { await logisticsService.saveDelivery(organizationId, order.id, parsed.data); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a entrega.') }
  }
  return <EditorPanel title="Informações de entrega" description={`${logisticsReference(order.id)} · ${order.productName} · ${quantity(order.quantityKg)}. Revise os locais; a sede do comprador não é usada como destino automático.`} onClose={onClose} busy={isSubmitting}>
    <details className="mb-5 text-xs text-muted-foreground"><summary className="cursor-pointer">Identificador técnico do pedido</summary><code className="mt-2 block break-all">{order.id}</code></details>
    <form noValidate onSubmit={(event) => { void handleSubmit(save)(event) }}><fieldset disabled={isSubmitting} className="space-y-5">
      {(['origin', 'destination'] as const).map((side) => <div key={side} className="space-y-3 rounded-lg border p-4"><h3 className="font-semibold">{side === 'origin' ? 'Origem' : 'Destino de entrega'}</h3>{(['label', 'city', 'state'] as const).map((field) => <label key={field} className="block text-xs font-medium">{`${side === 'origin' ? 'Origem' : 'Destino'} — ${field === 'label' ? 'local ou endereço' : field === 'city' ? 'município' : 'UF'}`}<input className={fieldClass} {...register(`${side}.${field}`)} /></label>)}
        <div className="grid grid-cols-2 gap-3">{(['Lat', 'Lng'] as const).map((axis) => { const key = `${side}${axis}` as 'originLat' | 'originLng' | 'destinationLat' | 'destinationLng'; return <label className="text-xs" key={axis}>{`${side === 'origin' ? 'Origem' : 'Destino'} — ${axis === 'Lat' ? 'latitude' : 'longitude'} (opcional)`}<input type="number" step="any" className={fieldClass} value={coordinates[key]} onChange={(e) => setCoordinates({ ...coordinates, [key]: e.target.value })} /></label> })}</div>
        <label className="block text-xs font-medium">{side === 'origin' ? 'Origem' : 'Destino'} — natureza das coordenadas<select className={fieldClass} value={coordinates[`${side}Source`]} onChange={(e) => setCoordinates({ ...coordinates, [`${side}Source`]: e.target.value as 'synthetic' | 'provided_reference' })}><option value="provided_reference">Referência informada, não verificada</option><option value="synthetic">Pontos sintéticos de referência</option></select></label>
      </div>)}

      <div className="grid grid-cols-2 gap-3"><label className="text-xs font-medium">Início da janela<input type="date" className={fieldClass} {...register('windowStart')} /></label><label className="text-xs font-medium">Fim da janela<input type="date" className={fieldClass} {...register('windowEnd')} /></label></div>
      <label className="block text-xs font-medium">Peso transportado (kg)<input readOnly type="number" className={fieldClass} {...register('weightKg', { valueAsNumber: true })} /></label>
      <label className="block text-xs font-medium">Distância de referência estimada (km)<input type="number" step="any" className={fieldClass} {...register('referenceDistanceKm', { valueAsNumber: true })} /></label>
      <fieldset className="space-y-2 text-xs"><legend className="mb-2 font-medium">Restrições de transporte</legend>{[['ambient', 'Temperatura ambiente'], ['refrigerated', 'Refrigeração'], ['fragile', 'Carga frágil']] .map(([value, label]) => <label key={value} className="flex gap-2"><input type="checkbox" value={value} {...register('restrictions')} />{label}</label>)}</fieldset>
      <p className="text-xs leading-5 text-muted-foreground">Distâncias são informadas para estimativa, sem consulta rodoviária. Coordenadas são referências; pontos sintéticos não representam endereços reais. Sem coordenadas, o transporte individual continua possível, mas não haverá recomendação geográfica definitiva.</p>
      {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-red-700">Revise locais, municípios, UF, datas, peso, distância positiva e restrições compatíveis.</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex gap-3"><Button type="submit">{isSubmitting ? 'Salvando…' : 'Salvar entrega'}</Button><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button></div>
    </fieldset></form>
  </EditorPanel>
}
