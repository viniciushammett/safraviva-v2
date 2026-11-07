import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom'
import { OverviewPage } from './overview-page'
import { OrdersPage } from '@/modules/orders/page'
import { MarketplacePage } from '@/modules/marketplace/page'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { commercialService, dashboardService, domainDatabase, logisticsService } from '@/services/domain'
import { defaultEnvironment } from '@/services/domain/command-context'
vi.mock('recharts', async (original) => {
  const actual = await original<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <actual.ResponsiveContainer width={700} height={256}>{children}</actual.ResponsiveContainer> }
})
async function ready(buyer = false) {
  useWorkspaceStore.setState({ activeWorkspaceId: buyer ? 'bom-preco' : 'santa-clara' })
  render(<MemoryRouter><OverviewPage /></MemoryRouter>)
  await screen.findByLabelText('Indicadores operacionais')
}
async function deliveredOrder() {
  await commercialService.confirmOrder('santa-clara', 'order-pending')
  await commercialService.prepareOrder('santa-clara', 'order-pending')
  const op = await logisticsService.createOperation('santa-clara', { partnerOrganizationId: 'rotas-do-campo', orderIds: ['order-pending'], transportMode: 'individual', vehicleCapacityKg: 1000, estimatedCost: 100 })
  await logisticsService.requestTransport('santa-clara', op.id)
  await logisticsService.dispatch('rotas-do-campo', op.id)
  await logisticsService.deliver('rotas-do-campo', op.id)
}
beforeEach(async () => {
  localStorage.clear(); useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' })
  vi.spyOn(defaultEnvironment, 'now').mockReturnValue('2026-11-06T12:00:00.000Z')
  await initializeDomain()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('operational overview', () => {
  it('renders the producer dashboard without redundant navigation cards', async () => {
    await ready()
    expect(screen.getByRole('heading', { name: 'Olá, João.' })).toBeTruthy()
    expect(screen.getByText('Vendas realizadas')).toBeTruthy()
    expect(screen.getByText('6.550 kg')).toBeTruthy()
    expect(screen.queryByText('Explore seu ambiente')).toBeNull()
    expect(screen.queryByText('Seu ambiente de trabalho')).toBeNull()
    expect(screen.getByText('2 pedidos aguardando confirmação')).toBeTruthy()
  })
  it('renders buyer supply indicators and regional live offers', async () => {
    await ready(true)
    expect(screen.getByText('Compras realizadas')).toBeTruthy()
    expect(screen.getByText('Fornecedores ativos')).toBeTruthy()
    expect(screen.getByText('Solicitações pendentes')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Oportunidades de abastecimento' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Tomate · Fazenda Santa Clara' }).getAttribute('href')).toBe('/buyer/marketplace?offer=offer-tomate')
  })
  it('shows delivered financial totals and chart from recorded events', async () => {
    await deliveredOrder(); await ready()
    const indicators = screen.getByLabelText('Indicadores operacionais')
    expect(within(indicators).getByText(/R\$\s*900,00/)).toBeTruthy()
    const chart = await screen.findByRole('figure', { name: 'Vendas entregues por dia' })
    expect(chart.textContent).toContain('1 pedidos entregues no período')
    expect(chart.textContent).toMatch(/900,00/)
    await waitFor(() => expect(document.querySelector('.recharts-bar')).toBeTruthy())
  })
  it('shows buyer completed purchases using the same verified delivery history', async () => {
    await deliveredOrder(); await ready(true)
    expect(within(screen.getByLabelText('Indicadores operacionais')).getByText(/R\$\s*900,00/)).toBeTruthy()
    expect((await screen.findByRole('figure', { name: 'Compras entregues por dia' })).textContent).toContain('1 pedidos entregues no período')
  })
  it.each(['7', '90'])('changes chart period to %s days via the service', async (days) => {
    const spy = vi.spyOn(dashboardService, 'overview')
    await ready(); fireEvent.change(screen.getByLabelText('Período do gráfico'), { target: { value: days } })
    await screen.findByLabelText('Período do gráfico')
    expect(spy).toHaveBeenLastCalledWith('santa-clara', Number(days))
    expect((screen.getByLabelText('Período do gráfico') as HTMLSelectElement).value).toBe(days)
  })
  it('shows real recommendations with their reference methodology', async () => {
    await ready()
    expect(screen.getByRole('heading', { name: 'Oportunidades de mercado' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Consultar inteligência' }).getAttribute('href')).toBe('/producer/intelligence')
    expect(screen.getAllByText(/Considere negociar/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Metodologia e limitações').length).toBeGreaterThan(0)
  })
  it('displays honest empty states', async () => {
    await domainDatabase.transaction((data) => { data.marketAnalyses = [] })
    await ready()
    expect(screen.getByText('Sem análises disponíveis para os produtos cadastrados.')).toBeTruthy()
    expect(screen.getByText('Nenhuma entrega registrada neste período.')).toBeTruthy()
  })
  it('refreshes indicators after commercial commands without persisting aggregates', async () => {
    await ready(); const initialKeys = Object.keys(localStorage)
    await act(async () => { await commercialService.confirmOrder('santa-clara', 'order-pending') })
    await screen.findByText('6.350 kg')
    expect(Object.keys(localStorage)).toEqual(initialKeys)
  })
  it('clears scoped content on workspace switch', async () => {
    await ready()
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' }) })
    await screen.findByText('Compras realizadas')
    expect(screen.queryByText('Produção disponível')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Oportunidades de mercado' })).toBeNull()
  })
  it('handles query failures without fictional metrics', async () => {
    vi.spyOn(dashboardService, 'overview').mockRejectedValue(new Error('Falha de leitura'))
    render(<MemoryRouter><OverviewPage /></MemoryRouter>)
    expect((await screen.findByRole('alert')).textContent).toBe('Falha de leitura')
    expect(screen.queryByLabelText('Indicadores operacionais')).toBeNull()
  })
  it('links a recent order to its scoped detail panel', async () => {
    const router = createMemoryRouter([{ path: '/producer/overview', element: <OverviewPage /> }, { path: '/producer/orders', element: <OrdersPage /> }], { initialEntries: ['/producer/overview'] })
    render(<RouterProvider router={router} />)
    const table = await screen.findByRole('table', { name: 'Pedidos recentes da organização' })
    fireEvent.click(within(table).getAllByRole('link')[0])
    expect(await screen.findByRole('dialog', { name: 'Detalhes do pedido' })).toBeTruthy()
    expect(router.state.location.search).toContain('order=')
  })
  it('opens the exact supply offer from a buyer opportunity', async () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' })
    const router = createMemoryRouter([{ path: '/buyer/overview', element: <OverviewPage /> }, { path: '/buyer/marketplace', element: <MarketplacePage /> }], { initialEntries: ['/buyer/overview'] })
    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('link', { name: 'Tomate · Fazenda Santa Clara' }))
    expect(await screen.findByRole('dialog', { name: 'Detalhes da oferta' })).toBeTruthy()
    expect(screen.getByLabelText('Quantidade desejada (kg)')).toBeTruthy()
  })
})
