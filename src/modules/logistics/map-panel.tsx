import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import type { DeliveryRow } from './types'
const OperationalMap = lazy(() => import('./operational-map'))
export class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <p role="status" className="p-5 text-sm">Mapa indisponível. Continue o planejamento pelas tabelas e formulários.</p> : this.props.children }
}
export function MapPanel({ loads, selectedIds, onSelect }: { loads: DeliveryRow[]; selectedIds: string[]; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const hasPoints = loads.some((load) => load.delivery?.origin.coordinates || load.delivery?.destination.coordinates)
  return <section className="min-w-0 rounded-xl border bg-white p-5 shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Mapa operacional</h2><p className="mt-2 text-xs text-muted-foreground">Origens, destinos e agrupamentos de referência. Sem GPS ou roteirização.</p></div><Button variant="outline" onClick={() => setOpen(!open)}>{open ? 'Ocultar mapa' : 'Carregar mapa'}</Button></div>
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Pontos de referência; linhas pontilhadas não são trajetos rodoviários. Pontos sintéticos estão identificados nos detalhes.</p>
    {!hasPoints && <p role="status" className="mt-4 text-sm text-muted-foreground">Sem coordenadas de referência disponíveis. Complete os dados das entregas para visualizar pontos.</p>}
    {open && <div className="relative isolate mt-5 min-w-0 overflow-hidden rounded-lg"><MapBoundary><Suspense fallback={<p role="status">Carregando mapa…</p>}><OperationalMap loads={loads} selectedIds={selectedIds} onSelect={onSelect} /></Suspense></MapBoundary></div>}
    <p className="mt-4 text-xs text-muted-foreground">Base cartográfica: <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Requer conexão; o fluxo logístico funciona sem o mapa.</p>
  </section>
}
