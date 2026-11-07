import { useCallback, useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { connectSupplierFavoritesEvents, useSupplierFavoritesStore } from '@/stores/supplier-favorites-store'
import { domainQueryService, supplierFavoritesService } from '@/services/domain'
import { currency, fieldClass } from '@/modules/production/presentation'
import { SupplierPanel } from './supplier-panel'
export function SuppliersPage() {
  const workspace = useActiveWorkspace()
  return <><PageHeader eyebrow="Abastecimento" title="Fornecedores" description="Consulte produtores, ofertas disponíveis e o histórico comercial da sua organização." />{workspace?.profile === 'buyer' ? <SupplierDirectory key={workspace.id} buyerId={workspace.id} /> : <p role="status">Selecione uma organização compradora para acessar fornecedores.</p>}</>
}
function SupplierDirectory({ buyerId }: { buyerId: string }) {
  const revision = useSupplierFavoritesStore((s) => s.revision)
  useEffect(connectSupplierFavoritesEvents, [])
  const load = useCallback(async () => { const [suppliers, preferences] = await Promise.all([domainQueryService.suppliers(buyerId), supplierFavoritesService.list(buyerId).then((favorites) => ({ favorites, error: '' })).catch((cause: unknown) => ({ favorites: [] as string[], error: cause instanceof Error ? cause.message : 'Não foi possível ler favoritos.' }))]); return { suppliers, ...preferences, favoriteRevision: revision } }, [buyerId, revision])
  const { data, loading, error } = useDomainQuery(load)
  const [search, setSearch] = useState('')
  const [region, setRegion] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [commandError, setCommandError] = useState('')
  async function favorite(supplierId: string, value: boolean) {
    if (busy) return
    setBusy(true); setCommandError(''); setMessage('')
    try { await supplierFavoritesService.set(buyerId, supplierId, value); setMessage(value ? 'Fornecedor adicionado aos favoritos.' : 'Fornecedor removido dos favoritos.') }
    catch (cause) { setCommandError(cause instanceof Error ? cause.message : 'Não foi possível atualizar o favorito.') }
    finally { setBusy(false) }
  }
  const suppliers = data?.suppliers.filter((s) => `${s.name} ${s.products.map((p) => p.name).join(' ')}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (!region || `${s.city}/${s.state}` === region) && (!favoritesOnly || !!data.error || data.favorites.includes(s.id))) ?? []
  const supplier = data?.suppliers.find((s) => s.id === selected)
  return <div className="space-y-5">
    {loading && <p role="status" className="text-sm text-muted-foreground">Carregando fornecedores…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {data?.error && <p role="alert" className="text-sm text-red-700">Favoritos indisponíveis: {data.error} O diretório continua disponível.</p>}
    {commandError && <p role="alert" className="text-sm text-red-700">{commandError}</p>}
    {message && <p role="status" className="rounded-lg border bg-muted p-4 text-sm text-primary">{message}</p>}
    {data && <section className="rounded-xl border bg-white shadow-soft"><div className="grid items-end gap-4 border-b p-5 md:grid-cols-[1fr_240px_auto]"><label className="text-xs font-medium">Pesquisar fornecedor ou produto<input className={fieldClass} type="search" value={search} onChange={(e) => setSearch(e.target.value)} /></label><label className="text-xs font-medium">Localidade do fornecedor<select className={fieldClass} value={region} onChange={(e) => setRegion(e.target.value)}><option value="">Todas as localidades</option>{[...new Set(data.suppliers.map((s) => `${s.city}/${s.state}`))].sort().map((r) => <option key={r}>{r}</option>)}</select></label><label className="flex h-10 items-center gap-2 text-xs"><input type="checkbox" checked={favoritesOnly} disabled={!!data.error} onChange={(e) => setFavoritesOnly(e.target.checked)} />Somente favoritos</label></div>
      <p className="border-b px-5 py-3 text-xs text-muted-foreground">{suppliers.length} de {data.suppliers.length} produtores cadastrados.</p><div className="relative overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Diretório de fornecedores</caption><thead className="bg-background text-muted-foreground"><tr>{['Fornecedor', 'Localidade', 'Produtos', 'Ofertas ativas', 'Histórico com sua organização', 'Ações'].map((label) => <th scope="col" className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody className="divide-y">{suppliers.map((s) => <tr key={s.id}><td className="px-4 py-4"><p className="mb-2 font-semibold">{s.name}</p><StatusBadge active={s.active}>{s.active ? 'Ativo' : 'Inativo'}</StatusBadge></td><td className="px-4 py-4">{s.city}/{s.state}</td><td className="max-w-64 px-4 py-4">{s.products.map((p) => p.name).join(', ') || 'Sem produtos comerciais disponíveis'}</td><td className="px-4 py-4">{s.activeOfferCount}</td><td className="px-4 py-4">{s.completedCount} pedidos entregues<span className="mt-1 block">{currency(s.completedAmount)}</span></td><td className="px-4 py-4"><div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => setSelected(s.id)}>Perfil comercial</Button><Button variant="ghost" size="icon" title={data.error || undefined} aria-label={`${data.favorites.includes(s.id) ? 'Remover' : 'Adicionar'} ${s.name} ${data.favorites.includes(s.id) ? 'dos' : 'aos'} favoritos`} aria-pressed={data.error ? undefined : data.favorites.includes(s.id)} disabled={busy || !!data.error} onClick={() => { void favorite(s.id, !data.favorites.includes(s.id)) }}><Star size={17} className={data.favorites.includes(s.id) ? 'fill-accent text-accent' : 'text-muted-foreground'} /></Button></div></td></tr>)}</tbody></table></div>
      {suppliers.length === 0 && <p role="status" className="p-8 text-center text-sm text-muted-foreground">Nenhum fornecedor encontrado para os filtros selecionados.</p>}
    </section>}
    {supplier && data && <SupplierPanel supplier={supplier} favoritesAvailable={!data.error} feedback={message} error={commandError || data.error} favorite={data.favorites.includes(supplier.id)} busy={busy} onClose={() => setSelected(null)} onFavorite={() => { void favorite(supplier.id, !data.favorites.includes(supplier.id)) }} />}
  </div>
}
