import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, createMemoryRouter, RouterProvider } from 'react-router-dom'
import { MarketplacePage } from '@/modules/marketplace/page'
import { OrdersPage } from '@/modules/orders/page'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { commercialService, domainDatabase, domainQueryService, logisticsService } from '@/services/domain'
import { defaultEnvironment } from '@/services/domain/command-context'
import { availableQuantity } from '@/domain/calculations'
import { LocalDomainDatabase } from '@/repositories/local/domain-database'
import { ProductionPage } from '@/modules/production/page'
import { availableOrderActions } from '@/domain/order-actions'

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
function row(id: string) { return screen.getAllByRole('row').find((r) => r.textContent?.includes(id))! }
async function mountMarket() { render(<MemoryRouter><MarketplacePage /></MemoryRouter>); await screen.findByRole('table') }
async function mountOrders(profile: 'buyer' | 'producer' = 'producer') {
  useWorkspaceStore.setState({ activeWorkspaceId: profile === 'producer' ? 'santa-clara' : 'bom-preco' })
  render(<MemoryRouter><OrdersPage /></MemoryRouter>); await screen.findByRole('table')
}
async function openOrder(id: string) {
  fireEvent.click(within(row(id)).getByRole('button', { name: 'Detalhes e ações' }))
  await screen.findByRole('dialog', { name: 'Detalhes do pedido' })
}
async function orderAction(label: string, status?: string) {
  click(label); click('Confirmar operação')
  if (status) await waitFor(async () => expect((await domainDatabase.snapshot()).orders.find((o) => o.id === 'order-pending')?.status).toBe(status))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirmar operação' })).toBeNull())
}
async function stock() { const d = await domainDatabase.snapshot(); return availableQuantity(d, d.offers.find((o) => o.id === 'offer-tomate')!) }
async function openTomato() { fireEvent.click(within(row('Tomate')).getByRole('button', { name: 'Detalhes e solicitar' })); await screen.findByLabelText('Quantidade desejada (kg)') }
beforeEach(async () => {
  localStorage.clear(); useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' })
  vi.spyOn(defaultEnvironment, 'now').mockReturnValue('2026-11-06T12:00:00.000Z')
  await initializeDomain()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('buyer marketplace', () => {
  it('renders only published offers with stock from different producers', async () => {
    await mountMarket()
    expect(screen.getByRole('heading', { name: 'Mercado Agrícola' })).toBeTruthy()
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getAllByText('Fazenda Santa Clara').length).toBe(2)
    expect(screen.getByText('Sítio Boa Esperança')).toBeTruthy()
    expect(screen.getByText('950 kg')).toBeTruthy()
    expect(screen.queryByText('Fazenda Horizonte')).toBeNull()
    expect((await domainQueryService.marketplace('bom-preco')).map((o) => o.id)).toEqual(['offer-tomate', 'offer-milho-future', 'offer-batata'])
  })
  it('excludes paused and fully committed offers', async () => {
    await commercialService.pauseOffer('santa-clara', 'offer-tomate')
    await commercialService.requestOrder('bom-preco', { offerId: 'offer-batata', quantityKg: 700, idempotencyKey: 'all' }).then((o) => commercialService.confirmOrder('boa-esperanca', o.id))
    await mountMarket()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText('Milho')).toBeTruthy()
    expect(screen.queryByText('Tomate')).toBeNull()
    expect(screen.queryByText('Batata')).toBeNull()
  })
  it.each([['Tomate', 'Tomate'], ['Boa Esperança', 'Batata']])('searches product or supplier %s', async (text, expected) => {
    await mountMarket(); change('Pesquisar produto ou fornecedor', text)
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(screen.getByText(expected)).toBeTruthy()
  })
  it('filters origin, category and availability', async () => {
    await mountMarket(); change('Região de origem', 'Valinhos/SP')
    expect(screen.getByText('Batata')).toBeTruthy(); expect(screen.queryByText('Tomate')).toBeNull()
    change('Região de origem', ''); change('Categoria', 'Grãos'); change('Disponibilidade', 'future')
    expect(screen.getByText('Milho')).toBeTruthy(); expect(screen.queryByText('Batata')).toBeNull()
    change('Disponibilidade', 'immediate')
    expect(screen.getByText(/Nenhuma oferta disponível/)).toBeTruthy()
  })
  it('shows details, commercial limitations and total using domain calculation', async () => {
    await mountMarket(); await openTomato(); change('Quantidade desejada (kg)', '10.125')
    expect(screen.getByRole('dialog', { name: 'Detalhes da oferta' })).toBeTruthy()
    expect(screen.getByText('Hortaliças', { selector: 'dd' })).toBeTruthy()
    expect(screen.getByText(/Pagamento, frete e endereço/)).toBeTruthy()
    expect(screen.getByText(/R\$\s*45,56/)).toBeTruthy()
  })
  it.each(['0', '-1', '0.0001', ''])('rejects invalid quantity %s', async (value) => {
    const spy = vi.spyOn(commercialService, 'requestOrder')
    await mountMarket(); await openTomato(); change('Quantidade desejada (kg)', value); click('Confirmar solicitação')
    expect(await screen.findByRole('alert')).toBeTruthy(); expect(spy).not.toHaveBeenCalled()
  })
  it('creates a pending request and event without reserving stock', async () => {
    await mountMarket(); await openTomato(); const before = await stock()
    change('Quantidade desejada (kg)', '100'); click('Confirmar solicitação')
    await screen.findByRole('heading', { name: 'Solicitação enviada' })
    const d = await domainDatabase.snapshot(); const order = d.orders.at(-1)!
    expect(order).toMatchObject({ quantityKg: 100, buyerOrganizationId: 'bom-preco', status: 'pending_confirmation', totalAmount: 450 })
    expect(d.domainEvents.at(-1)).toMatchObject({ aggregateId: order.id, eventType: 'order_requested' })
    expect(await stock()).toBe(before)
    expect(screen.getByRole('link', { name: 'Ver Pedidos e Compras' }).getAttribute('href')).toBe('/buyer/orders')
  })
  it('rejects requests exceeding current stock', async () => {
    await mountMarket(); await openTomato(); change('Quantidade desejada (kg)', '951'); click('Confirmar solicitação')
    expect((await screen.findByRole('alert')).textContent).toContain('saldo disponível')
    expect((await domainDatabase.snapshot()).orders.length).toBe(13)
  })
  it('reuses idempotency key when retrying after uncertain success', async () => {
    const actual = commercialService.requestOrder.bind(commercialService)
    let first = true
    const spy = vi.spyOn(commercialService, 'requestOrder').mockImplementation(async (actor, input) => {
      const result = await actual(actor, input)
      if (first) { first = false; throw new Error('Resposta indisponível. Tente novamente.') }
      return result
    })
    await mountMarket(); await openTomato(); change('Quantidade desejada (kg)', '10'); click('Confirmar solicitação')
    await screen.findByRole('alert'); click('Confirmar solicitação'); await screen.findByRole('heading', { name: 'Solicitação enviada' })
    expect(spy.mock.calls[0][1].idempotencyKey).toBe(spy.mock.calls[1][1].idempotencyKey)
    expect((await domainDatabase.snapshot()).orders.length).toBe(14)
  })
  it('reflects an offer that becomes unavailable while its panel is open', async () => {
    await mountMarket(); await openTomato()
    await act(async () => { await commercialService.pauseOffer('santa-clara', 'offer-tomate') })
    expect(await screen.findByText(/Esta oferta não está mais disponível/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Confirmar solicitação' })).toBeNull()
  })
  it('shows query errors without fictitious catalog data', async () => {
    vi.spyOn(domainQueryService, 'marketplace').mockRejectedValue(new Error('Falha ao ler o catálogo'))
    render(<MemoryRouter><MarketplacePage /></MemoryRouter>)
    expect((await screen.findByRole('alert')).textContent).toBe('Falha ao ler o catálogo')
    expect(screen.queryByRole('table')).toBeNull()
  })
  it('denies marketplace access to producer profile', async () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' })
    render(<MemoryRouter><MarketplacePage /></MemoryRouter>)
    expect(screen.queryByRole('table')).toBeNull()
    await expect(domainQueryService.marketplace('santa-clara')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
describe('producer and buyer orders', () => {
  it('lists only orders belonging to the active organization', async () => {
    await mountOrders()
    expect(screen.getByRole('heading', { name: 'Pedidos e Vendas' })).toBeTruthy()
    expect(screen.getByText('order-pending')).toBeTruthy(); expect(screen.queryByText('order-transit')).toBeNull()
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' }) })
    expect(await screen.findByText('order-transit')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Pedidos e Compras' })).toBeTruthy()
    expect(screen.queryByText('order-confirmed')).toBeNull()
  })
  it('filters and searches orders', async () => {
    await mountOrders(); change('Status do pedido', 'pending_confirmation')
    expect(screen.queryByText('order-confirmed')).toBeNull()
    change('Pesquisar pedidos', 'milho')
    expect(screen.getByText('order-future')).toBeTruthy(); expect(screen.queryByText('order-pending')).toBeNull()
    change('Pesquisar pedidos', 'missing')
    expect(screen.getByText(/Nenhum pedido encontrado/)).toBeTruthy()
  })
  it('confirms and reserves only after producer acceptance', async () => {
    await mountOrders(); const before = await stock(); await openOrder('order-pending')
    click('Aceitar pedido')
    expect(await stock()).toBe(before)
    click('Confirmar operação')
    await waitFor(async () => expect(await stock()).toBe(before - 200))
    expect(await screen.findByText('Pedido confirmado')).toBeTruthy()
  })
  it('rejects without reserving and retains history', async () => {
    await mountOrders(); const before = await stock(); await openOrder('order-pending'); await orderAction('Recusar pedido', 'rejected')
    expect(await stock()).toBe(before)
    expect(screen.getByText('Pedido recusado')).toBeTruthy()
    expect(screen.getByText('Solicitação enviada')).toBeTruthy()
  })
  it('blocks confirmation with insufficient stock', async () => {
    const extra = await commercialService.requestOrder('bom-preco', { offerId: 'offer-tomate', quantityKg: 900, idempotencyKey: 'consume' })
    await commercialService.confirmOrder('santa-clara', extra.id)
    await mountOrders(); await openOrder('order-pending'); click('Aceitar pedido'); click('Confirmar operação')
    expect((await screen.findByRole('alert')).textContent).toContain('Saldo insuficiente')
    expect((await domainDatabase.snapshot()).orders.find((o) => o.id === 'order-pending')?.status).toBe('pending_confirmation')
  })
  it('starts preparation and records the event', async () => {
    await mountOrders(); await openOrder('order-confirmed')
    await orderAction('Iniciar preparação')
    expect((await domainDatabase.snapshot()).orders.find((o) => o.id === 'order-confirmed')?.status).toBe('preparing')
    expect(await screen.findByText('Preparação iniciada')).toBeTruthy()
  })
  it('rejects preparation of future production', async () => {
    await commercialService.confirmOrder('santa-clara', 'order-future')
    await mountOrders(); await openOrder('order-future'); click('Iniciar preparação'); click('Confirmar operação')
    expect((await screen.findByRole('alert')).textContent).toContain('ainda não está disponível')
  })
  it('allows a buyer to cancel a pending order immediately', async () => {
    await mountOrders('buyer'); const before = await stock(); await openOrder('order-pending'); await orderAction('Cancelar pedido', 'cancelled')
    expect(await stock()).toBe(before)
    expect(await screen.findByText('Pedido cancelado')).toBeTruthy()
  })
  it('requests cancellation without releasing reservation and producer approval releases it', async () => {
    await commercialService.confirmOrder('santa-clara', 'order-pending')
    await mountOrders('buyer'); await openOrder('order-pending'); const reserved = await stock()
    await orderAction('Solicitar cancelamento')
    expect(await stock()).toBe(reserved)
    expect((await domainDatabase.snapshot()).orders.find((o) => o.id === 'order-pending')?.status).toBe('confirmed')
    expect(screen.queryByRole('button', { name: 'Solicitar cancelamento' })).toBeNull()
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' }) })
    await screen.findByRole('table'); await openOrder('order-pending')
    await orderAction('Aprovar cancelamento', 'cancelled')
    expect(await stock()).toBe(reserved + 200)
    expect(await screen.findByText('Cancelamento solicitado pelo comprador')).toBeTruthy()
  })
  it('shows transport history and available logistics without fabricating delivery', async () => {
    await mountOrders('buyer'); await openOrder('order-transit')
    const history = screen.getByRole('region', { name: 'Histórico operacional' })
    expect(within(history).getByText('Solicitação enviada')).toBeTruthy()
    expect(within(history).getByText('Transporte iniciado')).toBeTruthy()
    expect(within(history).queryByText('Entrega concluída')).toBeNull()
    expect(within(history).getByRole('listitem', { current: 'step' }).textContent).toContain('Transporte iniciado')
    expect(screen.getByText(/Rotas do Campo Transportes/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /cancelar|Solicitar cancelamento/i })).toBeNull()
  })
  it('shows delivery only after an actual logistics delivery event', async () => {
    await commercialService.confirmOrder('santa-clara', 'order-pending')
    await commercialService.prepareOrder('santa-clara', 'order-pending')
    const operation = await logisticsService.createOperation('santa-clara', { partnerOrganizationId: 'rotas-do-campo', orderIds: ['order-pending'], transportMode: 'individual', vehicleCapacityKg: 1000, estimatedCost: 50 })
    await logisticsService.requestTransport('santa-clara', operation.id)
    await logisticsService.dispatch('rotas-do-campo', operation.id)
    await logisticsService.deliver('rotas-do-campo', operation.id)
    await mountOrders('buyer'); await openOrder('order-pending')
    const history = screen.getByRole('region', { name: 'Histórico operacional' })
    expect(within(history).getByText('Entrega concluída')).toBeTruthy()
    expect(within(history).getByRole('listitem', { current: 'step' }).textContent).toContain('Entrega concluída')
    expect(screen.queryByRole('button', { name: /cancelar|Solicitar cancelamento/i })).toBeNull()
  })
  it('has no fictitious logistics for unassigned orders', async () => {
    await mountOrders(); await openOrder('order-pending')
    expect(screen.getByText('Nenhuma operação logística vinculada.')).toBeTruthy()
    expect(screen.getByText(/Endereço de entrega, prazo negociado/)).toBeTruthy()
  })
  it('preserves the contracted unit price when an offer price changes', async () => {
    await commercialService.editOffer('santa-clara', 'offer-tomate', { pricePerKg: 9 })
    const orders = await domainQueryService.ordersWorkspace('bom-preco')
    expect(orders.find((o) => o.id === 'order-pending')?.unitPrice).toBe(4.5)
  })
  it('does not expose other organizations orders or logistics order IDs', async () => {
    const orders = await domainQueryService.ordersWorkspace('bom-preco')
    expect(orders.every((o) => o.buyerOrganizationId === 'bom-preco')).toBe(true)
    expect(orders.find((o) => o.id === 'order-transit')?.logistics).not.toHaveProperty('orderIds')
    await expect(domainQueryService.ordersWorkspace('unknown')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('shows commands only for supported roles and states', async () => {
    const order = (await domainDatabase.snapshot()).orders[0]
    expect(availableOrderActions({ ...order, status: 'in_transit' }, 'buyer', false)).toEqual([])
    expect(availableOrderActions({ ...order, status: 'cancelled' }, 'producer', false)).toEqual([])
    expect(availableOrderActions({ ...order, status: 'confirmed' }, 'buyer', true)).toEqual([])
    expect(availableOrderActions(order, 'logistics_partner', false)).toEqual([])
  })
})
describe('integrated commercial journey', () => {
  it('navigates from request to orders and synchronizes producer confirmation and persisted buyer status', async () => {
    const router = createMemoryRouter([{ path: '/buyer/marketplace', element: <MarketplacePage /> }, { path: '/buyer/orders', element: <OrdersPage /> }, { path: '/producer/orders', element: <OrdersPage /> }], { initialEntries: ['/buyer/marketplace'] })
    render(<RouterProvider router={router} />); await screen.findByRole('table'); await openTomato()
    change('Quantidade desejada (kg)', '50'); click('Confirmar solicitação'); await screen.findByRole('heading', { name: 'Solicitação enviada' })
    const id = (await domainDatabase.snapshot()).orders.at(-1)!.id
    fireEvent.click(screen.getByRole('link', { name: 'Ver Pedidos e Compras' }))
    await screen.findByText(id)
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' }); await router.navigate('/producer/orders') })
    await screen.findByText(id); await openOrder(id); click('Aceitar pedido'); click('Confirmar operação')
    await screen.findByText('Pedido confirmado')
    await act(async () => { useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' }); await router.navigate('/buyer/orders') })
    await screen.findByText(id); expect(row(id).textContent).toContain('Confirmado')
    const db = new LocalDomainDatabase(localStorage)
    expect(await db.initialize()).toBe('loaded')
    expect((await db.snapshot()).orders.find((o) => o.id === id)?.status).toBe('confirmed')
    cleanup(); await mountOrders('buyer'); expect(row(id).textContent).toContain('Confirmado')
  })
  it('shows a newly published production offer in the buyer catalog', async () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' })
    render(<MemoryRouter><ProductionPage /></MemoryRouter>); await screen.findByRole('table')
    const offer = await commercialService.createOffer('santa-clara', { productionId: 'prod-tomate-sc', quantityKg: 25, pricePerKg: 5, availabilityType: 'immediate', availableFrom: '2026-11-01' })
    await act(async () => { await commercialService.publishOffer('santa-clara', offer.id) })
    cleanup(); useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' }); await mountMarket()
    expect(screen.getByText('25 kg')).toBeTruthy()
  })
})
