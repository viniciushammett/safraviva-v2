import { useSearchParams } from 'react-router-dom'
import { useCallback, useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { domainQueryService } from '@/services/domain'
import { cellClass, currency, dateLabel, fieldClass, quantity } from '@/modules/production/presentation'
import { OfferPanel } from './offer-panel'
export function MarketplacePage() {
  const workspace = useActiveWorkspace()
  const [params] = useSearchParams()
  return <><PageHeader eyebrow="Compras B2B" title="Mercado Agrícola" description="Consulte ofertas regionais e solicite compras diretamente aos produtores." />{workspace?.profile === 'buyer' ? <MarketplaceWorkspace key={workspace.id} organizationId={workspace.id} initialOffer={params.get('offer')} initialProducer={params.get('producer')} /> : <p role="status">Selecione uma organização compradora para consultar o mercado.</p>}</>
}
function MarketplaceWorkspace({ organizationId, initialOffer, initialProducer }: { organizationId: string; initialOffer: string | null; initialProducer: string | null }) {
  const load = useCallback(() => domainQueryService.marketplace(organizationId), [organizationId])
  const { data, loading, error } = useDomainQuery(load, { keepPreviousData: true })
  const [producerFilter, setProducerFilter] = useState(initialProducer ?? '')
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [category, setCategory] = useState('')
  const [availability, setAvailability] = useState('')
  const [selected, setSelected] = useState<string | null>(initialOffer)
  const [message, setMessage] = useState('')
  const offers = data?.filter((o) => (!producerFilter || o.producerOrganizationId === producerFilter) && `${o.productName} ${o.producerName}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!region || o.region === region) && (!category || o.category === category) && (!availability || o.availabilityType === availability)) ?? []
  return <>
    {producerFilter && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm"><p>Ofertas do fornecedor selecionado.</p><Button variant="outline" size="sm" onClick={() => setProducerFilter('')}>Mostrar todos os fornecedores</Button></div>}
    {message && <p role="status" className="mb-5 rounded-lg border bg-muted p-4 text-sm text-primary">{message}</p>}
    {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}
    <section className="rounded-xl border bg-white shadow-soft" aria-label="Ofertas disponíveis">
      <div className="grid gap-4 border-b p-5 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-xs font-medium">Pesquisar produto ou fornecedor<input type="search" className={fieldClass} value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="text-xs font-medium">Região de origem<select className={fieldClass} value={region} onChange={(e) => setRegion(e.target.value)}><option value="">Todas as regiões</option>{[...new Set(data?.map((o) => o.region))].sort().map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="text-xs font-medium">Categoria<select className={fieldClass} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas as categorias</option>{[...new Set(data?.map((o) => o.category))].sort().map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-xs font-medium">Disponibilidade<select className={fieldClass} value={availability} onChange={(e) => setAvailability(e.target.value)}><option value="">Todas</option><option value="immediate">Imediata</option><option value="future">Colheita futura</option></select></label>
      </div>
      {loading && <p role="status" className="p-5 text-sm text-muted-foreground">Atualizando ofertas…</p>}
      {data && <><p className="border-b px-5 py-3 text-xs text-muted-foreground">{offers.length} ofertas encontradas. Quantidades em kg.</p><div className="overflow-x-auto"><table className="w-full"><caption className="sr-only">Ofertas publicadas com saldo disponível</caption><thead className="bg-background text-muted-foreground"><tr>{['Produto', 'Produtor', 'Origem', 'Quantidade disponível', 'Preço / kg', 'Disponibilidade', 'Data', 'Ações'].map((h) => <th scope="col" key={h} className={`${cellClass} font-medium`}>{h}</th>)}</tr></thead><tbody className="divide-y">{offers.map((offer) => <tr key={offer.id}><td className={cellClass}>{offer.productName}</td><td className={cellClass}>{offer.producerName}</td><td className={cellClass}>{offer.region}</td><td className={cellClass}>{quantity(offer.availableQuantityKg)}</td><td className={cellClass}>{currency(offer.pricePerKg)}</td><td className={cellClass}>{offer.availabilityType === 'future' ? 'Colheita futura' : 'Imediata'}</td><td className={cellClass}>{dateLabel(offer.availableFrom)}</td><td className={cellClass}><Button variant="outline" size="sm" onClick={() => setSelected(offer.id)}>Detalhes e solicitar</Button></td></tr>)}</tbody></table></div>{offers.length === 0 && <p role="status" className="p-10 text-center text-sm text-muted-foreground">Nenhuma oferta disponível para os filtros selecionados.</p>}</>}
    </section>
    {selected && data && <OfferPanel key={selected} organizationId={organizationId} offer={data.find((o) => o.id === selected) ?? null} onClose={() => setSelected(null)} onRequested={(id) => setMessage(`Solicitação enviada: ${id}. Aguardando confirmação do produtor.`)} />}
  </>
}
