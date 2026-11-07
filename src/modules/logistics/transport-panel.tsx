import { logisticsReference } from './references'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { EditorPanel } from '@/modules/production/editor-panel'
import { fieldClass, quantity } from '@/modules/production/presentation'
import { logisticsService } from '@/services/domain'
import type { LogisticsQuote } from '@/domain/logistics-planning'
import type { LogisticsWorkspace } from './types'
import { CostComparison } from './cost-comparison'
export function TransportPanel({ organizationId, data, initialIds, onClose, onSaved }: { organizationId: string; data: LogisticsWorkspace; initialIds: string[]; onClose: () => void; onSaved: () => void }) {
  const [ids, setIds] = useState(initialIds)
  const [partnerId, setPartnerId] = useState('')
  const [mode, setMode] = useState<'individual' | 'shared'>(initialIds.length > 1 ? 'shared' : 'individual')
  const [quote, setQuote] = useState<LogisticsQuote | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  async function simulate() {
    setBusy(true); setError(''); setQuote(null)
    try { setQuote(await logisticsService.quoteTransport(organizationId, ids, partnerId, mode)) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível comparar o transporte.') } finally { setBusy(false) }
  }
  async function confirm() {
    if (busy) return
    setBusy(true); setError('')
    try { await logisticsService.organizeTransport(organizationId, { orderIds: ids, partnerId, mode, expectedQuote: quote ?? undefined }); onSaved() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível registrar o transporte.') } finally { setBusy(false) }
  }
  return <EditorPanel title="Organizar transporte" description="Selecione somente seus pedidos. Revise a comparação antes de confirmar a solicitação logística." onClose={onClose} busy={busy}>
    <fieldset disabled={busy} className="space-y-4">
      <fieldset className="space-y-3"><legend className="mb-3 text-sm font-semibold">Pedidos próprios elegíveis</legend>{data.pending.map((order) => <label key={order.id} className="flex items-start gap-3 text-xs"><input type="checkbox" checked={ids.includes(order.id)} onChange={(e) => { setQuote(null); setIds(e.target.checked ? [...ids, order.id] : ids.filter((id) => id !== order.id)) }} /><span className="min-w-0 break-words" title={order.id}>{logisticsReference(order.id)} · {order.productName} · {quantity(order.quantityKg)}{!order.delivery && ' · Complete os dados logísticos'}</span></label>)}</fieldset>
      <label className="block text-xs font-medium">Parceiro logístico<select className={fieldClass} value={partnerId} onChange={(e) => { setQuote(null); setPartnerId(e.target.value) }}><option value="">Selecione um parceiro</option>{data.partners.map((partner) => <option key={partner.id} value={partner.id} disabled={!partner.logisticsProfile?.available}>{partner.name}{!partner.logisticsProfile?.available && ' — sem disponibilidade cadastrada'}</option>)}</select></label>
      <label className="block text-xs font-medium">Modalidade<select className={fieldClass} value={mode} onChange={(e) => { setQuote(null); setMode(e.target.value as typeof mode) }}><option value="individual">Transporte individual</option><option value="shared">Transporte compartilhado</option></select></label>
      <Button variant="outline" onClick={() => { void simulate() }}>{busy ? 'Analisando…' : 'Comparar custos'}</Button>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {quote && <><CostComparison quote={quote} /><p className="text-xs leading-5">{mode === 'individual' ? 'Transporte individual' : 'Transporte compartilhado'} · {quote.partnerName}.</p><details className="text-xs leading-5 text-muted-foreground"><summary className="cursor-pointer">Critérios da comparação</summary><p className="mt-2">{quote.justification}</p></details><Button onClick={() => setConfirming(true)}>Solicitar transporte</Button></>}
    </fieldset>
    {confirming && <Dialog open onOpenChange={(open) => { if (!open && !busy) setConfirming(false) }}><DialogContent><DialogTitle className="font-semibold">Confirmar solicitação logística?</DialogTitle><DialogDescription className="mt-3 text-sm">Pedidos: {ids.map((id) => logisticsReference(id)).join(', ')}. Os dados e a elegibilidade serão validados novamente. Somente seus pedidos serão associados. Não haverá contratação externa ou início automático do transporte.</DialogDescription>{error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex gap-3"><Button disabled={busy} onClick={() => { void confirm() }}>Confirmar transporte</Button><Button variant="outline" disabled={busy} onClick={() => setConfirming(false)}>Voltar</Button></div></DialogContent></Dialog>}
  </EditorPanel>
}
