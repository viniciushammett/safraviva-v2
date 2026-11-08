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
  it.each([false, true])('shows a compact empty state without Recharts (buyer=%s)', async (buyer) => {
    vi.mocked(defaultEnvironment.now).mockReturnValue('2027-03-06T12:00:00.000Z')
    await ready(buyer)
    expect(screen.getByRole('heading', { name: buyer ? 'Desempenho de compras' : 'Desempenho de vendas' })).toBeTruthy()
    const title = screen.getByRole('heading', { name: 'Nenhuma entrega concluída neste período' })
    expect(title.parentElement?.classList.contains('h-48')).toBe(true)
    expect(screen.getAllByText('O desempenho comercial será exibido conforme os pedidos forem entregues.')).toHaveLength(1)
    expect(screen.queryByRole('figure')).toBeNull()
    expect(document.querySelector('.recharts-wrapper')).toBeNull()
    expect(screen.queryByText('Nenhuma entrega registrada neste período.')).toBeNull()
    expect(within(screen.getByLabelText('Indicadores operacionais')).getAllByRole('term')).toHaveLength(4)
    expect(screen.getByLabelText('Período do gráfico')).toBeTruthy()
  })
  it.each([false, true])('renders the chart for a delivered order even with zero value (buyer=%s)', async (buyer) => {
    vi.mocked(defaultEnvironment.now).mockReturnValue('2027-03-06T12:00:00.000Z')
    await commercialService.editOffer('santa-clara', 'offer-tomate-draft', { pricePerKg: 0 })
    await commercialService.publishOffer('santa-clara', 'offer-tomate-draft')
    const order = await commercialService.requestOrder('bom-preco', { offerId: 'offer-tomate-draft', quantityKg: 1, idempotencyKey: 'zero-value-delivery' })
    await commercialService.confirmOrder('santa-clara', order.id)
    await commercialService.prepareOrder('santa-clara', order.id)
    const operation = await logisticsService.createOperation('santa-clara', { partnerOrganizationId: 'rotas-do-campo', orderIds: [order.id], transportMode: 'individual', vehicleCapacityKg: 1000, estimatedCost: 0 })
    await logisticsService.requestTransport('santa-clara', operation.id)
    await logisticsService.dispatch('rotas-do-campo', operation.id)
    await logisticsService.deliver('rotas-do-campo', operation.id)
    await ready(buyer)
    const chart = await screen.findByRole('figure', { name: buyer ? 'Compras entregues por dia' : 'Vendas entregues por dia' })
    expect(chart.textContent).toMatch(/1 pedidos entregues no período.*0,00/)
    expect(screen.queryByText('Nenhuma entrega concluída neste período')).toBeNull()
    await waitFor(() => expect(document.querySelector('.recharts-wrapper')).toBeTruthy())
  })
  it('uses full width and a responsive internal grid only for buyer opportunities', async () => {
    await ready(true)
    const section = screen.getByRole('heading', { name: 'Oportunidades de abastecimento' }).closest('section')!
    expect(section.classList.contains('xl:col-span-2')).toBe(true)
    const list = within(section).getByRole('list')
    expect(list.classList.contains('grid-cols-1')).toBe(true)
    expect(list.classList.contains('sm:grid-cols-2')).toBe(true)
    expect(list.classList.contains('xl:grid-cols-3')).toBe(true)
    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items.every((item) => item.classList.contains('min-w-0') && item.classList.contains('break-words'))).toBe(true)
    expect(section.textContent).toMatch(/Campinas\/SP.*950 kg.*4,50/)
    expect(within(section).getByRole('link', { name: 'Consultar mercado' }).getAttribute('href')).toBe('/buyer/marketplace')
    cleanup(); await ready()
    const producerSection = screen.getByRole('heading', { name: 'Oportunidades de mercado' }).closest('section')!
    expect(producerSection.classList.contains('xl:col-span-2')).toBe(false)
    expect(within(producerSection).getByRole('list').classList.contains('grid')).toBe(false)
    expect(screen.getByRole('heading', { name: 'Alertas operacionais' })).toBeTruthy()
    expect(screen.getByRole('table', { name: 'Pedidos recentes da organização' })).toBeTruthy()
  })
  it('shows delivered financial totals and chart from recorded events', async () => {
    await deliveredOrder(); await ready()
    const indicators = screen.getByLabelText('Indicadores operacionais')
    expect(within(indicators).getByText(/R\$\s*3\.150,00/)).toBeTruthy()
    const chart = await screen.findByRole('figure', { name: 'Vendas entregues por dia' })
    expect(chart.textContent).toContain('5 pedidos entregues no período')
    expect(chart.textContent).toMatch(/3\.150,00/)
    await waitFor(() => expect(document.querySelector('.recharts-bar')).toBeTruthy())
  })
  it('shows buyer completed purchases using the same verified delivery history', async () => {
    await deliveredOrder(); await ready(true)
    expect(within(screen.getByLabelText('Indicadores operacionais')).getByText(/R\$\s*3\.270,00/)).toBeTruthy()
    expect((await screen.findByRole('figure', { name: 'Compras entregues por dia' })).textContent).toContain('5 pedidos entregues no período')
  })
  it.each([['7', false], ['30', false], ['90', false], ['7', true], ['30', true], ['90', true]])('changes chart period to %s days (buyer=%s)', async (days, buyer) => {
    const spy = vi.spyOn(dashboardService, 'overview')
    await ready(Boolean(buyer)); fireEvent.change(screen.getByLabelText('Período do gráfico'), { target: { value: String(days) } })
    await screen.findByLabelText('Período do gráfico')
    expect(spy).toHaveBeenLastCalledWith(buyer ? 'bom-preco' : 'santa-clara', Number(days))
    expect((screen.getByLabelText('Período do gráfico') as HTMLSelectElement).value).toBe(String(days))
  })
  it('shows real recommendations with their reference methodology', async () => {
    await ready()
    expect(screen.getByRole('heading', { name: 'Oportunidades de mercado' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Consultar inteligência' }).getAttribute('href')).toBe('/producer/intelligence')
    expect(screen.getAllByText(/Considere negociar/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Metodologia e limitações').length).toBeGreaterThan(0)
  })
  it('displays honest empty states', async () => {
    vi.mocked(defaultEnvironment.now).mockReturnValue('2027-03-06T12:00:00.000Z')
    await domainDatabase.transaction((data) => { data.marketAnalyses = [] })
    await ready()
    expect(screen.getByText('Sem análises disponíveis para os produtos cadastrados.')).toBeTruthy()
    expect(screen.getByText('Nenhuma entrega concluída neste período')).toBeTruthy()
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
