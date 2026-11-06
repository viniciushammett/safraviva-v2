import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { commercialService, domainQueryService } from '@/services/domain'
import { createProductionSchema } from '@/domain/schemas'
import { commercialPlanSchema } from '@/services/domain/market-intelligence-service'
import type { CreateProductionInput } from '@/services/domain/commercial-service'
import { useIntelligenceSession } from '@/modules/intelligence/session-store'
import { planningHandoffSchema } from './planning-handoff'
import { ProductionForm, type PlanningContext } from './production-form'
import { OfferForm } from './offer-form'
import { EditorPanel } from './editor-panel'
import { cellClass, currency, dateLabel, fieldClass, offerStatuses, productionStatuses, quantity, type ProducerWorkspace } from './presentation'

type Editor = { kind: 'production'; id?: string } | { kind: 'offer'; id?: string; productionId?: string } | { kind: 'production-detail' | 'offer-detail'; id: string } | null
type OfferAction = 'publishOffer' | 'pauseOffer' | 'closeOffer'
const actionLabels: Record<OfferAction, string> = { publishOffer: 'Publicar', pauseOffer: 'Pausar', closeOffer: 'Encerrar' }
interface PlanSeed { initial: CreateProductionInput; context: PlanningContext }
function readPlan(): PlanSeed | null {
  const simulation = useIntelligenceSession.getState().simulation
  if (!simulation) return null
  const input = commercialPlanSchema.safeParse(simulation.input)
  const draft = createProductionSchema.safeParse(simulation.result.productionDraft)
  return input.success && draft.success ? { initial: draft.data, context: { region: input.data.region, desiredPricePerKg: input.data.desiredPricePerKg } } : null
}

export function ProductionPage() {
  const workspace = useActiveWorkspace()
  const location = useLocation()
  const navigate = useNavigate()
  const handoff = planningHandoffSchema.safeParse(location.state)
  const requested = handoff.success && handoff.data.organizationId === workspace?.id
  useEffect(() => {
    if (location.state !== null) void navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])
  if (!workspace || workspace.profile !== 'producer') return <><PageHeader eyebrow="Operação comercial" title="Produção e Ofertas" description="Gerencie sua produção e suas ofertas agrícolas." /><p role="status">Selecione uma organização produtora para acessar este módulo.</p></>
  return <ProductionWorkspace key={workspace.id} organizationId={workspace.id} planningRequested={requested} />
}
function ProductionWorkspace({ organizationId, planningRequested }: { organizationId: string; planningRequested: boolean }) {
  const load = useCallback(() => domainQueryService.producerWorkspace(organizationId), [organizationId])
  const query = useDomainQuery(load, { keepPreviousData: true })
  const [plan, setPlan] = useState(() => planningRequested ? readPlan() : null)
  const [editor, setEditor] = useState<Editor>(() => plan ? { kind: 'production' } : null)
  const [tab, setTab] = useState<'productions' | 'offers'>('productions')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [message, setMessage] = useState(planningRequested && !plan ? 'O planejamento não está mais disponível. Execute uma nova simulação.' : '')
  const [suggestion, setSuggestion] = useState<{ productionId: string; price: number } | null>(null)
  const [confirmation, setConfirmation] = useState<{ action: OfferAction; id: string; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data = query.data
  function selectTab(next: typeof tab) { setTab(next); setStatus(''); setSearch('') }
  async function confirm() {
    if (!confirmation || busy) return
    setBusy(true); setError(null)
    try {
      await commercialService[confirmation.action](organizationId, confirmation.id)
      setMessage(`Oferta atualizada: ${confirmation.label.toLowerCase()}.`); setConfirmation(null)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar a oferta.') }
    finally { setBusy(false) }
  }
  const matches = (name: string, id: string, rowStatus: string) => `${name} ${id}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!status || rowStatus === status)
  const productions = data?.productions.filter((p) => matches(p.productName, p.id, p.status)) ?? []
  const offers = data?.offers.filter((o) => matches(o.productName, `${o.id} ${o.productionId}`, o.status)) ?? []
  function requestAction(action: OfferAction, id: string, label = actionLabels[action]) { setError(null); setConfirmation({ action, id, label }) }
  return <>
    <PageHeader eyebrow="Operação comercial" title="Produção e Ofertas" description="Organize volumes, acompanhe colheitas e gerencie suas ofertas comerciais." action={<Button disabled={!data} onClick={() => setEditor(tab === 'productions' ? { kind: 'production' } : { kind: 'offer' })}><Plus size={16} />{tab === 'productions' ? 'Nova produção' : 'Nova oferta'}</Button>} />
    {message && <p role="status" className="mb-5 rounded-lg border border-primary/20 bg-muted p-4 text-sm text-primary">{message}</p>}
    {query.error && <p role="alert" className="mb-5 text-sm text-red-700">{query.error}</p>}
    <div role="tablist" aria-label="Gestão comercial" className="mb-6 flex gap-2 border-b">
      {([['productions', 'Produções'], ['offers', 'Ofertas Comerciais']] as const).map(([key, label]) => <button key={key} id={`tab-${key}`} role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} tabIndex={tab === key ? 0 : -1} className={`border-b-2 px-4 py-3 text-sm font-medium ${tab === key ? 'border-accent text-primary' : 'border-transparent text-muted-foreground'}`} onClick={() => selectTab(key)} onKeyDown={(event) => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 'productions' : event.key === 'End' ? 'offers' : tab === 'productions' ? 'offers' : 'productions'; selectTab(next); document.getElementById(`tab-${next}`)?.focus() } }}>{label}</button>)}
    </div>
    <section role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rounded-xl border bg-white shadow-soft">
      <div className="grid gap-4 border-b p-5 sm:grid-cols-[1fr_220px]"><label className="text-xs font-medium">Pesquisar<input className={fieldClass} type="search" value={search} placeholder="Produto ou identificação" onChange={(e) => setSearch(e.target.value)} /></label><label className="text-xs font-medium">Filtrar por status<select className={fieldClass} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option>{Object.entries(tab === 'productions' ? productionStatuses : offerStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      {query.loading ? <p role="status" className="p-8 text-sm text-muted-foreground">Carregando dados comerciais…</p> : data && <>
        <p className="border-b px-5 py-3 text-xs text-muted-foreground">{tab === 'productions' ? `${productions.length} de ${data.productions.length} produções` : `${offers.length} de ${data.offers.length} ofertas`} nesta organização.</p>
        <div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">{tab === 'productions' ? 'Produções da organização' : 'Ofertas da organização'}</caption><thead className="bg-background text-muted-foreground"><tr>{(tab === 'productions' ? ['Produto', 'Quantidade prevista', 'Quantidade colhida', 'Colheita estimada', 'Situação', 'Vinculado a ofertas', 'Ações'] : ['Produto / Produção', 'Anunciado', 'Reservado / vendido', 'Saldo disponível', 'Preço / kg', 'Disponibilidade', 'Data', 'Status', 'Ações']).map((label) => <th key={label} scope="col" className={`${cellClass} font-medium`}>{label}</th>)}</tr></thead>
          <tbody className="divide-y">{tab === 'productions' ? productions.map((p) => <tr key={p.id}>
            <td className={cellClass}><span className="font-medium">{p.productName}</span><span className="mt-1 block text-[10px] text-muted-foreground">{p.id}</span></td><td className={cellClass}>{quantity(p.estimatedQuantityKg)}</td><td className={cellClass}>{quantity(p.harvestedQuantityKg)}</td><td className={cellClass}>{dateLabel(p.expectedHarvestDate)}</td><td className={cellClass}><StatusBadge active={p.status === 'growing'}>{productionStatuses[p.status]}</StatusBadge></td><td className={cellClass}>{quantity(p.allocatedQuantityKg)}</td>
            <td className={cellClass}><div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEditor({ kind: 'production-detail', id: p.id })}>Detalhes</Button>{p.status !== 'finished' && <><Button size="sm" variant="ghost" onClick={() => setEditor({ kind: 'production', id: p.id })}>Editar</Button><Button size="sm" variant="outline" onClick={() => setEditor({ kind: 'offer', productionId: p.id })}>Criar oferta</Button></>}</div></td>
          </tr>) : offers.map((o) => <tr key={o.id}>
            <td className={cellClass}><span className="font-medium">{o.productName}</span><span className="mt-1 block text-[10px] text-muted-foreground">{o.productionId}</span></td><td className={cellClass}>{quantity(o.quantityKg)}</td><td className={cellClass}>{quantity(o.committedQuantityKg)}</td><td className={cellClass}>{quantity(o.availableQuantityKg)}</td><td className={cellClass}>{currency(o.pricePerKg)}</td><td className={cellClass}>{o.availabilityType === 'future' ? 'Colheita futura' : 'Imediata'}</td><td className={cellClass}>{dateLabel(o.availableFrom)}</td><td className={cellClass}><StatusBadge active={o.status === 'published'}>{offerStatuses[o.status]}</StatusBadge></td>
            <td className={cellClass}><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => setEditor({ kind: 'offer-detail', id: o.id })}>Detalhes</Button>{o.status !== 'closed' && <><Button variant="ghost" size="sm" onClick={() => setEditor({ kind: 'offer', id: o.id })}>Editar</Button>{o.status === 'published' ? <Button variant="outline" size="sm" onClick={() => requestAction('pauseOffer', o.id)}>Pausar</Button> : <Button variant="outline" size="sm" onClick={() => requestAction('publishOffer', o.id, o.status === 'paused' ? 'Reativar' : 'Publicar')}>{o.status === 'paused' ? 'Reativar' : 'Publicar'}</Button>}<Button variant="ghost" size="sm" onClick={() => requestAction('closeOffer', o.id)}>Encerrar</Button></>}</div></td>
          </tr>)}</tbody></table></div>
        {(tab === 'productions' ? productions : offers).length === 0 && <div role="status" className="p-10 text-center"><h2 className="font-medium">Nenhum registro encontrado</h2><p className="mt-2 text-sm text-muted-foreground">Revise os filtros ou utilize a ação de cadastro para começar.</p></div>}
        {tab === 'offers' && <p className="border-t px-5 py-4 text-xs leading-5 text-muted-foreground">Pedidos pendentes não reservam estoque. O volume comprometido inclui pedidos confirmados, em preparação, em transporte e entregues. O saldo de uma oferta pausada ou encerrada não significa que ela esteja disponível para novas solicitações.</p>}
      </>}
    </section>
    {data && editor && <WorkspaceEditor editor={editor} data={data} organizationId={organizationId} plan={plan} suggestion={suggestion} onClose={() => { setEditor(null); setPlan(null) }} onProductionSaved={(p) => { if (!editor.id && plan) setSuggestion({ productionId: p.id, price: plan.context.desiredPricePerKg }); setPlan(null); setEditor(null); setMessage('Produção salva com sucesso.') }} onOfferSaved={() => { setEditor(null); setMessage('Oferta salva com sucesso.'); setTab('offers'); setSearch(''); setStatus('') }} />}
    {confirmation && <Dialog open onOpenChange={(open) => { if (!open && !busy) setConfirmation(null) }}><DialogContent><DialogTitle className="text-lg font-semibold">{confirmation.label} oferta?</DialogTitle><DialogDescription className="mt-3 text-sm leading-6">{confirmation.action === 'closeOffer' ? 'O encerramento é definitivo. Volumes já comprometidos permanecem vinculados.' : 'Confirme a alteração de disponibilidade comercial da oferta. As regras de saldo e produção serão verificadas.'}</DialogDescription>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}<div className="mt-6 flex gap-3"><Button disabled={busy} onClick={() => { void confirm() }}>{busy ? 'Atualizando…' : `Confirmar ${confirmation.label.toLowerCase()}`}</Button><Button variant="outline" disabled={busy} onClick={() => setConfirmation(null)}>Cancelar</Button></div></DialogContent></Dialog>}
  </>
}
function WorkspaceEditor({ editor, data, organizationId, plan, suggestion, onClose, onProductionSaved, onOfferSaved }: {
  editor: NonNullable<Editor>; data: ProducerWorkspace; organizationId: string; plan: PlanSeed | null; suggestion: { productionId: string; price: number } | null; onClose: () => void; onProductionSaved: (p: import('@/types/domain').Production) => void; onOfferSaved: () => void
}) {
  const production = data.productions.find((p) => p.id === editor.id)
  const offer = data.offers.find((o) => o.id === editor.id)
  if (editor.id && ((editor.kind.startsWith('production') && !production) || (editor.kind.startsWith('offer') && !offer))) return <EditorPanel title="Registro indisponível" description="O registro não está mais disponível nesta organização." onClose={onClose}><p>Feche o painel e tente novamente.</p></EditorPanel>
  if (editor.kind === 'production') return <ProductionForm organizationId={organizationId} products={data.products} production={production} initial={!editor.id ? plan?.initial : undefined} context={!editor.id ? plan?.context : undefined} onClose={onClose} onSaved={onProductionSaved} />
  if (editor.kind === 'offer') return <OfferForm organizationId={organizationId} data={data} offer={offer} initialProductionId={editor.productionId} desiredPrice={suggestion?.productionId === editor.productionId ? suggestion?.price : undefined} onClose={onClose} onSaved={onOfferSaved} />
  const record = editor.kind === 'production-detail' ? production : offer
  if (!record) return <EditorPanel title="Registro indisponível" description="O registro não está mais disponível nesta organização." onClose={onClose}><p>Atualize a consulta e tente novamente.</p></EditorPanel>
  const details = editor.kind === 'production-detail' && production ? [
    ['Identificação', production.id], ['Produto', production.productName], ['Quantidade prevista', quantity(production.estimatedQuantityKg)], ['Quantidade colhida', quantity(production.harvestedQuantityKg)], ['Colheita estimada', dateLabel(production.expectedHarvestDate)], ['Situação', productionStatuses[production.status]], ['Vinculado a ofertas', quantity(production.allocatedQuantityKg)], ['Volume comercializável', quantity(production.commercialVolumeKg)],
  ] : offer ? [
    ['Identificação', offer.id], ['Produto', offer.productName], ['Produção vinculada', offer.productionId], ['Quantidade anunciada', quantity(offer.quantityKg)], ['Reservado / vendido', quantity(offer.committedQuantityKg)], ['Saldo disponível', quantity(offer.availableQuantityKg)], ['Preço por kg', currency(offer.pricePerKg)], ['Disponibilidade', offer.availabilityType === 'future' ? 'Colheita futura' : 'Imediata'], ['Data de disponibilidade', dateLabel(offer.availableFrom)], ['Status', offerStatuses[offer.status]],
  ] : []
  return <EditorPanel title={editor.kind === 'production-detail' ? 'Detalhes da produção' : 'Detalhes da oferta'} description="Dados comerciais da organização ativa." onClose={onClose}><dl className="space-y-4">{details.concat([['Criado em', dateLabel(record.createdAt)], ['Atualizado em', dateLabel(record.updatedAt)]]).map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value}</dd></div>)}</dl></EditorPanel>
}
