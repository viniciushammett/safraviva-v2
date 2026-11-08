import { logisticsReference } from './references'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LogisticsPage } from './page'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { commercialService, domainDatabase, logisticsService } from '@/services/domain'
import { defaultEnvironment } from '@/services/domain/command-context'
vi.mock('./operational-map', () => ({ default: () => { throw new Error('Map unavailable') } }))
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
async function mount(path = '/producer/logistics') { render(<MemoryRouter initialEntries={[path]}><LogisticsPage /></MemoryRouter>); await screen.findByText('Entregas Pendentes') }
function pendingRow(id: string) { return within(screen.getByRole('table', { name: 'Entregas pendentes da organização' })).getAllByRole('row').find((row) => row.textContent?.includes(logisticsReference(id)))! }
const demo = () => logisticsService.importReferenceScenario('santa-clara', { confirmed: true })
beforeEach(async () => {
  localStorage.clear(); useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' })
  vi.spyOn(defaultEnvironment, 'now').mockReturnValue('2026-11-06T12:00:00.000Z')
  await initializeDomain()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('logistics operational UI', () => {
  it('renders three operational sections and existing partner information', async () => {
    await mount()
    for (const name of ['Entregas Pendentes', 'Oportunidades de Consolidação', 'Transportes em Andamento', 'Mapa operacional']) expect(screen.getByRole('heading', { name })).toBeTruthy()
    expect(screen.getByText(/Veículo de referência com carga seca/)).toBeTruthy()
    expect(screen.getByText(/Nenhuma entrega pendente/)).toBeTruthy()
  })
  it('lists only eligible own deliveries and searches them', async () => {
    await demo(); await mount()
    expect(pendingRow('reference-4a-order-0')).toBeTruthy()
    expect(pendingRow('reference-4a-order-1')).toBeUndefined()
    change('Pesquisar entregas', 'reference-4a-order-3')
    expect(pendingRow('reference-4a-order-0')).toBeUndefined()
    expect(pendingRow('reference-4a-order-3')).toBeTruthy()
  })
  it('makes missing logistics information explicit', async () => {
    await commercialService.confirmOrder('santa-clara', 'order-pending'); await mount()
    expect(pendingRow('order-pending').textContent).toContain('Completar cadastro')
    fireEvent.click(within(pendingRow('order-pending')).getByRole('button', { name: 'Analisar transporte' }))
    change('Parceiro logístico', 'rotas-do-campo'); click('Comparar custos')
    expect((await screen.findByRole('alert')).textContent).toContain('Complete os dados logísticos')
    expect(screen.queryByRole('button', { name: 'Solicitar transporte' })).toBeNull()
  })
  it('validates delivery fields and saves origin, destination and window without financial mutation', async () => {
    await commercialService.confirmOrder('santa-clara', 'order-pending'); await mount('/producer/logistics?order=order-pending')
    await screen.findByRole('dialog', { name: 'Informações de entrega' }); click('Salvar entrega')
    expect(await screen.findByRole('alert')).toBeTruthy()
    change('Origem — local ou endereço', 'Local de coleta informado'); change('Origem — município', 'Campinas')
    change('Destino — local ou endereço', 'Destino explicitamente informado'); change('Destino — município', 'Valinhos')
    change('Início da janela', '2026-11-10'); change('Fim da janela', '2026-11-11'); change('Distância de referência estimada (km)', '30')
    click('Salvar entrega'); await screen.findByText('Informações de entrega salvas.')
    const order = (await domainDatabase.snapshot()).orders.find((o) => o.id === 'order-pending')!
    expect(order.delivery?.destination.label).toBe('Destino explicitamente informado')
    expect(order.delivery?.destination.coordinates).toBeUndefined()
    expect(order.totalAmount).toBe(900)
  })
  it('preserves distinct source declarations for origin and destination coordinates', async () => {
    await demo()
    await domainDatabase.transaction((data) => { data.orders.find((o) => o.id === 'reference-4a-order-0')!.delivery!.origin.coordinates!.source = 'provided_reference' })
    await mount('/producer/logistics?order=reference-4a-order-0')
    expect((screen.getByLabelText('Origem — natureza das coordenadas') as HTMLSelectElement).value).toBe('provided_reference')
    expect((screen.getByLabelText('Destino — natureza das coordenadas') as HTMLSelectElement).value).toBe('synthetic')
    click('Salvar entrega'); await screen.findByText('Informações de entrega salvas.')
    const delivery = (await domainDatabase.snapshot()).orders.find((o) => o.id === 'reference-4a-order-0')!.delivery!
    expect(delivery.origin.coordinates?.source).toBe('provided_reference')
    expect(delivery.destination.coordinates?.source).toBe('synthetic')
  })
  it('shows cross-producer suggestions as uncontracted and computes fresh own quote', async () => {
    await demo(); await mount()
    expect(screen.getAllByText('Adesão dos demais produtores necessária').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Analisar apenas meus pedidos' })[0])
    const dialog = screen.getByRole('dialog', { name: 'Organizar transporte' })
    expect(within(dialog).queryByText(/reference-4a-order-1/)).toBeNull()
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2)
  })
  it('compares and confirms an own shared transport with no automatic delivery', async () => {
    await demo(); await mount(); click('Organizar transporte')
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(logisticsReference('reference-4a-order-0')) }))
    fireEvent.click(screen.getByRole('checkbox', { name: new RegExp(logisticsReference('reference-4a-order-3')) }))
    change('Parceiro logístico', 'rotas-do-campo'); change('Modalidade', 'shared'); click('Comparar custos')
    const panel = screen.getByRole('dialog', { name: 'Organizar transporte' })
    await within(panel).findByText('Individual (soma das viagens)')
    expect(within(panel).getByText('Economia estimada')).toBeTruthy()
    click('Solicitar transporte')
    expect((await domainDatabase.snapshot()).logistics).toHaveLength(8)
    click('Confirmar transporte')
    await screen.findByText(/Transporte solicitado com sucesso/)
    const data = await domainDatabase.snapshot()
    expect(data.logistics.at(-1)?.status).toBe('transport_requested')
    expect(data.orders.find((o) => o.id === 'reference-4a-order-0')?.status).toBe('confirmed')
  })
  it('requires explicit confirmation for additive demo import', async () => {
    await mount(); click('Importar cenário de referência')
    expect((await domainDatabase.snapshot()).orders).toHaveLength(13)
    click('Confirmar'); await screen.findByText(/Cenário sintético de referência disponível/)
    expect((await domainDatabase.snapshot()).orders).toHaveLength(17)
  })
  it('consults operational status and history without advancing states', async () => {
    await mount()
    const operationRow = screen.getAllByRole('row').find((row) => row.textContent?.includes(logisticsReference('logistics-planned', 'operation')))!
    fireEvent.click(within(operationRow).getByRole('button', { name: 'Consultar operação' }))
    const panel = screen.getByRole('dialog', { name: 'Operação logística' })
    expect(within(panel).getByText('Operação registrada')).toBeTruthy()
    expect(within(panel).queryByRole('button', { name: /Entregar|Iniciar transporte/ })).toBeNull()
    click('Revisar e solicitar transporte'); click('Confirmar')
    expect((await screen.findByRole('alert')).textContent).toContain('Complete os dados')
  })
  it('remains functional when the optional map fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await demo(); await mount(); click('Carregar mapa')
    expect(await screen.findByText(/Mapa indisponível. Continue/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Organizar transporte' })).toBeTruthy()
    click('Organizar transporte'); expect(screen.getByRole('dialog', { name: 'Organizar transporte' })).toBeTruthy()
  })
  it('does not expose logistics workspace to a buyer', async () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' })
    render(<MemoryRouter><LogisticsPage /></MemoryRouter>)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Selecione uma organização produtora/)).toBeTruthy()
  })
  it('updates eligible rows when a commercial confirmation occurs externally', async () => {
    await mount()
    await act(async () => { await commercialService.confirmOrder('santa-clara', 'order-pending') })
    await waitFor(() => expect(pendingRow('order-pending')).toBeTruthy())
  })
})
