import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { SuppliersPage } from './page'
import { MarketplacePage } from '@/modules/marketplace/page'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { domainDatabase, supplierFavoritesService } from '@/services/domain'
import { SUPPLIER_FAVORITES_KEY } from '@/repositories/supplier-favorites-repository'
async function mount() { render(<MemoryRouter><SuppliersPage /></MemoryRouter>); await screen.findByRole('table', { name: 'Diretório de fornecedores' }) }
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
function supplierRow(name: string) { return screen.getAllByRole('row').find((r) => r.textContent?.includes(name))! }
beforeEach(async () => { localStorage.clear(); useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' }); await initializeDomain() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('supplier directory', () => {
  it('lists registered producers with offers and buyer-specific completed history', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Fornecedores' })).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(supplierRow('Fazenda Santa Clara').textContent).toContain('Tomate, Milho')
    expect(supplierRow('Fazenda Horizonte').textContent).toContain('0 pedidos entregues')
  })
  it('filters names, products and locations', async () => {
    await mount(); change('Pesquisar fornecedor ou produto', 'batata')
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('Sítio Boa Esperança')).toBeTruthy()
    change('Pesquisar fornecedor ou produto', ''); change('Localidade do fornecedor', 'Indaiatuba/SP')
    expect(screen.getByText('Fazenda Horizonte')).toBeTruthy()
    expect(screen.queryByText('Fazenda Santa Clara')).toBeNull()
  })
  it('opens a commercial profile without exposing another buyers completed orders', async () => {
    await mount(); fireEvent.click(within(supplierRow('Fazenda Horizonte')).getByRole('button', { name: 'Perfil comercial' }))
    const panel = screen.getByRole('dialog', { name: 'Perfil do fornecedor' })
    expect(within(panel).getByText('Indaiatuba/SP')).toBeTruthy()
    expect(within(panel).getByText('Sua organização ainda não tem pedidos entregues por este fornecedor.')).toBeTruthy()
    expect(within(panel).queryByText(/880,00/)).toBeNull()
  })
  it('adds, filters and removes favorites with confirmed persistence', async () => {
    await mount()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Fazenda Santa Clara aos favoritos' }))
    await screen.findByRole('button', { name: 'Remover Fazenda Santa Clara dos favoritos' })
    fireEvent.click(screen.getByLabelText('Somente favoritos'))
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(SUPPLIER_FAVORITES_KEY)!).buyers['bom-preco']).toEqual(['santa-clara'])
    fireEvent.click(screen.getByRole('button', { name: 'Remover Fazenda Santa Clara dos favoritos' }))
    expect(await screen.findByText('Nenhum fornecedor encontrado para os filtros selecionados.')).toBeTruthy()
  })
  it('preserves favorites across remount without changing commercial records', async () => {
    await mount(); const before = await domainDatabase.snapshot()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Sítio Boa Esperança aos favoritos' }))
    await screen.findByRole('button', { name: 'Remover Sítio Boa Esperança dos favoritos' })
    cleanup(); await mount()
    expect(screen.getByRole('button', { name: 'Remover Sítio Boa Esperança dos favoritos' })).toBeTruthy()
    expect(await domainDatabase.snapshot()).toEqual(before)
  })
  it('does not reuse another buyers favorite set', async () => {
    await supplierFavoritesService.set('restaurante-central', 'horizonte', true)
    await mount(); fireEvent.click(screen.getByLabelText('Somente favoritos'))
    expect(screen.getByText('Nenhum fornecedor encontrado para os filtros selecionados.')).toBeTruthy()
  })
  it('refreshes after a cross-tab preference event', async () => {
    await mount()
    await act(async () => {
      localStorage.setItem(SUPPLIER_FAVORITES_KEY, JSON.stringify({ version: 1, buyers: { 'bom-preco': ['horizonte'] } }))
      window.dispatchEvent(new StorageEvent('storage', { key: SUPPLIER_FAVORITES_KEY }))
    })
    expect(await screen.findByRole('button', { name: 'Remover Fazenda Horizonte dos favoritos' })).toBeTruthy()
  })
  it('keeps the directory usable when favorites cannot be read', async () => {
    localStorage.setItem(SUPPLIER_FAVORITES_KEY, 'invalid')
    await mount()
    expect((await screen.findByRole('alert')).textContent).toContain('Favoritos indisponíveis')
    expect(screen.getByText('Fazenda Santa Clara')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Adicionar Fazenda Santa Clara aos favoritos' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(within(supplierRow('Fazenda Santa Clara')).getByRole('button', { name: 'Perfil comercial' }))
    expect(screen.getByRole('dialog', { name: 'Perfil do fornecedor' })).toBeTruthy()
    expect(localStorage.getItem(SUPPLIER_FAVORITES_KEY)).toBe('invalid')
  })
  it('shows write errors without marking an unpersisted favorite', async () => {
    vi.spyOn(supplierFavoritesService, 'set').mockRejectedValue(new Error('Não foi possível salvar'))
    await mount(); fireEvent.click(screen.getByRole('button', { name: 'Adicionar Fazenda Santa Clara aos favoritos' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível salvar')
    expect(screen.getByRole('button', { name: 'Adicionar Fazenda Santa Clara aos favoritos' }).getAttribute('aria-pressed')).toBe('false')
  })
  it('denies access to a producer workspace and clears the supplier profile', async () => {
    await mount(); fireEvent.click(within(supplierRow('Fazenda Santa Clara')).getByRole('button', { name: 'Perfil comercial' }))
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' }) })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Selecione uma organização compradora/)).toBeTruthy()
  })
  it('navigates from supplier profile to a filtered marketplace', async () => {
    const router = createMemoryRouter([{ path: '/buyer/suppliers', element: <SuppliersPage /> }, { path: '/buyer/marketplace', element: <MarketplacePage /> }], { initialEntries: ['/buyer/suppliers'] })
    render(<RouterProvider router={router} />); await screen.findByRole('table')
    fireEvent.click(within(supplierRow('Sítio Boa Esperança')).getByRole('button', { name: 'Perfil comercial' }))
    fireEvent.click(screen.getByRole('link', { name: 'Consultar ofertas no mercado' }))
    await screen.findByRole('table')
    expect(router.state.location.search).toBe('?producer=boa-esperanca')
    expect(screen.getByText('Batata')).toBeTruthy(); expect(screen.queryByText('Tomate')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar todos os fornecedores' }))
    expect(screen.getByText('Tomate')).toBeTruthy()
  })
})
