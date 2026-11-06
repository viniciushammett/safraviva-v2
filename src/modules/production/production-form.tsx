import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { createProductionSchema } from '@/domain/schemas'
import { commercialService } from '@/services/domain'
import type { CreateProductionInput } from '@/services/domain/commercial-service'
import type { Product, Production } from '@/types/domain'
import { EditorPanel } from './editor-panel'
import { fieldClass, productionStatuses } from './presentation'
export interface PlanningContext { region: string; desiredPricePerKg: number }
export function ProductionForm({ organizationId, products, production, initial, context, onClose, onSaved }: {
  organizationId: string; products: Product[]; production?: Production; initial?: CreateProductionInput; context?: PlanningContext; onClose: () => void; onSaved: (production: Production) => void
}) {
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateProductionInput>({ resolver: zodResolver(createProductionSchema), defaultValues: production ? { productId: production.productId, estimatedQuantityKg: production.estimatedQuantityKg, harvestedQuantityKg: production.harvestedQuantityKg, expectedHarvestDate: production.expectedHarvestDate, status: production.status } : initial ?? { productId: '', harvestedQuantityKg: 0, status: 'growing', expectedHarvestDate: '' } })
  async function save(input: CreateProductionInput) {
    setError(null)
    try {
      const { productId, ...changes } = input
      const result = production ? await commercialService.updateProduction(organizationId, production.id, changes) : await commercialService.createProduction(organizationId, { productId, ...changes })
      onSaved(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a produção.') }
  }
  const statuses = Object.entries(productionStatuses).filter(([status]) => !production || status === production.status || (production.status === 'growing' && status === 'harvested') || (production.status === 'harvested' && status === 'finished'))
  return <EditorPanel title={production ? 'Editar produção' : 'Nova produção'} description="Revise os dados e confirme o cadastro. O volume comercializável será validado pelo serviço comercial." onClose={onClose} busy={isSubmitting}>
    {context && <p className="mb-5 rounded-lg bg-muted p-3 text-xs leading-5">Planejamento: {context.region}. Preço desejado: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.desiredPricePerKg)}/kg. Região e preço são contexto do plano e não serão gravados como atributos da produção.</p>}
    <form onSubmit={(event) => { void handleSubmit(save)(event) }} noValidate>
      <fieldset disabled={isSubmitting} className="space-y-4">
        <label className="block text-xs font-medium">Produto agrícola<select className={fieldClass} {...register('productId')} disabled={!!production}><option value="">Selecione um produto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label className="block text-xs font-medium">Quantidade prevista (kg)<input type="number" step="0.001" className={fieldClass} {...register('estimatedQuantityKg', { valueAsNumber: true })} /></label>
        <label className="block text-xs font-medium">Quantidade colhida (kg)<input type="number" step="0.001" className={fieldClass} {...register('harvestedQuantityKg', { valueAsNumber: true })} /></label>
        <label className="block text-xs font-medium">Data estimada de colheita<input type="date" className={fieldClass} {...register('expectedHarvestDate')} /></label>
        <label className="block text-xs font-medium">Situação da produção<select className={fieldClass} {...register('status')}>{statuses.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-red-700">Revise produto, quantidades e data. A quantidade prevista deve ser positiva; a colhida não pode ser negativa. Utilize até três casas decimais.</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex gap-3 border-t pt-5"><Button type="submit">{isSubmitting ? 'Salvando…' : 'Confirmar produção'}</Button><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button></div>
      </fieldset>
    </form>
  </EditorPanel>
}
