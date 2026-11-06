import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router-dom'
import { ProductionPage } from './page'
import { IntelligencePage } from '@/modules/intelligence/page'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { commercialService, domainDatabase, domainQueryService, marketIntelligenceService } from '@/services/domain'
import { defaultEnvironment } from '@/services/domain/command-context'
import { useIntelligenceSession } from '@/modules/intelligence/session-store'
import { planningHandoff } from './planning-handoff'
import { LocalDomainDatabase } from '@/repositories/local/domain-database'

const click = (name: string) => fireEvent.click(screen.getByRole('button', { name }))
const change = (name: string, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } })
function row(text: string) { return screen.getAllByRole('row').find((r) => r.textContent?.includes(text))! }
async function mount() {
  render(<MemoryRouter><ProductionPage /></MemoryRouter>)
  await screen.findByRole('table')
}
async function offersTab() {
  fireEvent.click(screen.getByRole('tab', { name: 'Ofertas Comerciais' }))
  await screen.findByRole('table', { name: 'Ofertas da organização' })
}
function fillProduction() {
  change('Produto agrícola', 'cenoura'); change('Quantidade prevista (kg)', '1000'); change('Quantidade colhida (kg)', '0'); change('Data estimada de colheita', '2026-11-25')
}
async function saveProduction() {
  click('Nova produção'); fillProduction(); click('Confirmar produção')
  await screen.findByText('Produção salva com sucesso.')
  await screen.findByRole('table')
}
async function openOffer() {
  await offersTab(); click('Nova oferta')
  change('Produção vinculada', 'prod-tomate-sc'); change('Quantidade anunciada (kg)', '100'); change('Preço por kg (R$)', '4.8'); change('Tipo de disponibilidade', 'immediate'); change('Data de disponibilidade', '2026-11-01')
}
beforeEach(async () => {
  localStorage.clear()
  vi.spyOn(defaultEnvironment, 'now').mockReturnValue('2026-11-06T12:00:00.000Z')
  useWorkspaceStore.setState({ activeWorkspaceId: 'santa-clara' })
  useIntelligenceSession.setState({ simulation: null, plan: {}, analysis: null, filters: { productId: '', region: '', periodDays: 30 } })
  await initializeDomain()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('production operations', () => {
  it('renders scoped productions and derived allocations', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Produção e Ofertas' })).toBeTruthy()
    expect(row('prod-tomate-sc').textContent).toContain('1.500 kg')
    expect(screen.queryByText('prod-batata-be')).toBeNull()
  })
  it('switches tabs and lists offers with committed and available quantities', async () => {
    await mount(); await offersTab()
    const published = screen.getAllByRole('row').find((r) => r.textContent?.includes('Tomate') && r.textContent.includes('Publicada'))!
    expect(published.textContent).toContain('250 kg')
    expect(published.textContent).toContain('950 kg')
    expect(screen.queryByText('prod-batata-be')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Produções' }))
    expect(await screen.findByText('prod-tomate-sc')).toBeTruthy()
  })
  it('filters status, searches and presents empty state', async () => {
    await mount(); change('Filtrar por status', 'growing')
    expect(screen.queryByText('prod-tomate-sc')).toBeNull()
    expect(screen.getByText('prod-milho-sc')).toBeTruthy()
    change('Pesquisar', 'inexistente')
    expect(screen.getByText('Nenhum registro encontrado')).toBeTruthy()
  })
  it('creates a production and refreshes the table', async () => {
    await mount(); await saveProduction()
    expect(screen.getByText('Cenoura')).toBeTruthy()
    const created = (await domainDatabase.snapshot()).productions.at(-1)!
    expect(created).toMatchObject({ productId: 'cenoura', estimatedQuantityKg: 1000, harvestedQuantityKg: 0, producerOrganizationId: 'santa-clara', status: 'growing' })
  })
  it.each(['-1', '0', '1.0001'])('validates planned quantity %s', async (value) => {
    await mount(); click('Nova produção'); fillProduction(); change('Quantidade prevista (kg)', value); click('Confirmar produção')
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect((await domainDatabase.snapshot()).productions.length).toBe(4)
  })
  it('shows production details', async () => {
    await mount(); fireEvent.click(within(row('prod-tomate-sc')).getByRole('button', { name: 'Detalhes' }))
    expect(await screen.findByRole('dialog', { name: 'Detalhes da produção' })).toBeTruthy()
    expect(screen.getByText('Volume comercializável')).toBeTruthy()
  })
  it('edits allowed fields and updates growing to harvested', async () => {
    await mount(); fireEvent.click(within(row('prod-milho-sc')).getByRole('button', { name: 'Editar' }))
    change('Quantidade colhida (kg)', '4500'); change('Situação da produção', 'harvested'); click('Confirmar produção')
    await screen.findByText('Produção salva com sucesso.')
    expect((await domainDatabase.snapshot()).productions.find((p) => p.id === 'prod-milho-sc')).toMatchObject({ status: 'harvested', harvestedQuantityKg: 4500 })
  })
  it('prevents reducing production below allocated offers', async () => {
    await mount(); fireEvent.click(within(row('prod-tomate-sc')).getByRole('button', { name: 'Editar' }))
    change('Quantidade colhida (kg)', '100'); click('Confirmar produção')
    expect((await screen.findByRole('alert')).textContent).toContain('inferior às ofertas')
    expect((await domainDatabase.snapshot()).productions[0].harvestedQuantityKg).toBe(1800)
  })
  it('persists creation across unmount and a new database instance', async () => {
    await mount(); await saveProduction(); cleanup(); await mount()
    expect(screen.getByText('Cenoura')).toBeTruthy()
    const db = new LocalDomainDatabase(localStorage)
    expect(await db.initialize()).toBe('loaded')
    expect((await db.snapshot()).productions.at(-1)?.productId).toBe('cenoura')
  })
  it('preserves unsaved form input while domain data refreshes', async () => {
    await mount(); click('Nova produção'); fillProduction(); change('Quantidade prevista (kg)', '987')
    await act(async () => { await commercialService.createProduction('santa-clara', { productId: 'alface-crespa', estimatedQuantityKg: 10, harvestedQuantityKg: 0, expectedHarvestDate: '2026-11-25', status: 'growing' }) })
    await screen.findByText('Alface Crespa', { selector: 'span' })
    expect((screen.getByLabelText('Quantidade prevista (kg)') as HTMLInputElement).value).toBe('987')
  })
  it('provides read-only actions for a finished production', async () => {
    await commercialService.updateProduction('santa-clara', 'prod-tomate-sc', { status: 'finished' })
    await mount()
    expect(within(row('prod-tomate-sc')).queryByRole('button', { name: 'Editar' })).toBeNull()
    expect(within(row('prod-tomate-sc')).queryByRole('button', { name: 'Criar oferta' })).toBeNull()
    expect(within(row('prod-tomate-sc')).getByRole('button', { name: 'Detalhes' })).toBeTruthy()
  })
  it('handles storage failure without partial mutation', async () => {
    const spy = vi.spyOn(commercialService, 'createProduction').mockRejectedValue(new Error('Persistência indisponível'))
    await mount(); click('Nova produção'); fillProduction(); click('Confirmar produção')
    expect((await screen.findByRole('alert')).textContent).toBe('Persistência indisponível')
    expect(spy).toHaveBeenCalled()
    expect((await domainDatabase.snapshot()).productions.length).toBe(4)
  })
  it('denies access through a nonproducer workspace', async () => {
    useWorkspaceStore.setState({ activeWorkspaceId: 'bom-preco' })
    render(<MemoryRouter><ProductionPage /></MemoryRouter>)
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.getByText(/Selecione uma organização produtora/)).toBeTruthy()
  })
})
describe('offer operations', () => {
  it('creates a linked draft offer', async () => {
    await mount(); await openOffer(); click('Confirmar oferta')
    await screen.findByText('Oferta salva com sucesso.')
    expect((await domainDatabase.snapshot()).offers.at(-1)).toMatchObject({ productionId: 'prod-tomate-sc', quantityKg: 100, pricePerKg: 4.8, status: 'draft' })
  })
  it('rejects offers exceeding commercial volume', async () => {
    await mount(); await openOffer(); change('Quantidade anunciada (kg)', '301'); click('Confirmar oferta')
    expect((await screen.findByRole('alert')).textContent).toContain('volume comercializável')
  })
  it('protects committed quantities when editing', async () => {
    await mount(); await offersTab()
    const published = screen.getAllByRole('row').find((r) => r.textContent?.includes('Tomate') && r.textContent.includes('Publicada'))!
    fireEvent.click(within(published).getByRole('button', { name: 'Editar' }))
    change('Quantidade anunciada (kg)', '249'); click('Confirmar oferta')
    expect((await screen.findByRole('alert')).textContent).toContain('reservado ou vendido')
    expect((await domainDatabase.snapshot()).offers.find((o) => o.id === 'offer-tomate')?.quantityKg).toBe(1200)
  })
  it('edits offer prices without changing its linked production', async () => {
    await mount(); await offersTab()
    const draft = screen.getAllByRole('row').find((r) => r.textContent?.includes('Rascunho'))!
    fireEvent.click(within(draft).getByRole('button', { name: 'Editar' }))
    change('Preço por kg (R$)', '5'); click('Confirmar oferta')
    await screen.findByText('Oferta salva com sucesso.')
    expect((await domainDatabase.snapshot()).offers.find((o) => o.id === 'offer-tomate-draft')?.pricePerKg).toBe(5)
  })
  it('publishes, pauses, reactivates and closes with explicit confirmations', async () => {
    await mount(); await offersTab()
    for (const [action, expected] of [['Publicar', 'published'], ['Pausar', 'paused'], ['Reativar', 'published'], ['Encerrar', 'closed']] as const) {
      const target = action === 'Publicar' ? row('Rascunho') : screen.getAllByRole('row').find((r) => r.textContent?.includes('300 kg'))!
      fireEvent.click(within(target).getByRole('button', { name: action }))
      expect((await domainDatabase.snapshot()).offers.find((o) => o.id === 'offer-tomate-draft')?.status).not.toBe(expected)
      click(`Confirmar ${action.toLowerCase()}`)
      await waitFor(async () => expect((await domainDatabase.snapshot()).offers.find((o) => o.id === 'offer-tomate-draft')?.status).toBe(expected))
      await screen.findByRole('table')
    }
    expect(within(row('Encerrada')).queryByRole('button', { name: 'Editar' })).toBeNull()
  })
  it('can cancel a relevant action without mutation', async () => {
    await mount(); await offersTab(); const before = await domainDatabase.snapshot()
    fireEvent.click(within(row('Rascunho')).getByRole('button', { name: 'Encerrar' })); click('Cancelar')
    expect(await domainDatabase.snapshot()).toEqual(before)
  })
  it('creates a future harvest offer', async () => {
    await mount(); await openOffer(); change('Produção vinculada', 'prod-milho-sc'); change('Tipo de disponibilidade', 'future'); change('Data de disponibilidade', '2026-11-26'); click('Confirmar oferta')
    await screen.findByText('Oferta salva com sucesso.')
    expect((await domainDatabase.snapshot()).offers.at(-1)).toMatchObject({ availabilityType: 'future', availableFrom: '2026-11-26', productionId: 'prod-milho-sc' })
  })
  it('rejects availability before harvest', async () => {
    await mount(); await openOffer(); change('Produção vinculada', 'prod-milho-sc'); change('Tipo de disponibilidade', 'future'); change('Data de disponibilidade', '2026-11-20'); click('Confirmar oferta')
    expect((await screen.findByRole('alert')).textContent).toContain('anterior à colheita')
  })
  it('rejects future availability today or earlier', async () => {
    await mount(); await openOffer(); change('Tipo de disponibilidade', 'future'); change('Data de disponibilidade', '2026-11-06'); click('Confirmar oferta')
    expect((await screen.findByRole('alert')).textContent).toContain('data de disponibilidade futura')
  })
  it('rejects immediate availability for a growing production', async () => {
    await mount(); await openOffer(); change('Produção vinculada', 'prod-milho-sc'); click('Confirmar oferta')
    expect((await screen.findByRole('alert')).textContent).toContain('produção colhida')
  })
  it('shows offer details', async () => {
    await mount(); await offersTab(); fireEvent.click(within(row('Rascunho')).getByRole('button', { name: 'Detalhes' }))
    expect(await screen.findByRole('dialog', { name: 'Detalhes da oferta' })).toBeTruthy()
    expect(screen.getByText('offer-tomate-draft')).toBeTruthy()
  })
  it('handles publication errors in the confirmation dialog', async () => {
    vi.spyOn(commercialService, 'publishOffer').mockRejectedValue(new Error('Oferta totalmente comprometida.'))
    await mount(); await offersTab(); fireEvent.click(within(row('Rascunho')).getByRole('button', { name: 'Publicar' })); click('Confirmar publicar')
    expect((await screen.findByRole('alert')).textContent).toContain('totalmente comprometida')
  })
  it('isolates query results by organization, including finished production', async () => {
    const data = await domainQueryService.producerWorkspace('boa-esperanca')
    expect(data.productions.map((p) => p.id)).toEqual(['prod-batata-be'])
    expect(data.offers.map((o) => o.id)).toEqual(['offer-batata'])
    const other = await domainQueryService.producerWorkspace('horizonte')
    expect(other.productions[0].status).toBe('finished')
    expect(other.productions[0].allocatedQuantityKg).toBe(800)
  })
})
describe('planning handoff', () => {
  it('opens a reviewed draft without writes and reuses desired price for its offer', async () => {
    const input = { productId: 'tomate-italiano', region: 'Região de Campinas/SP', plannedQuantityKg: 1000, desiredPricePerKg: 5.5, expectedHarvestDate: '2026-11-25' }
    const result = await marketIntelligenceService.simulate(input)
    useIntelligenceSession.setState({ simulation: { result, input, revision: 0 } })
    const before = await domainDatabase.snapshot()
    const router = createMemoryRouter([{ path: '/producer/intelligence', element: <IntelligencePage /> }, { path: '/producer/production', element: <ProductionPage /> }], { initialEntries: ['/producer/intelligence'] })
    render(<RouterProvider router={router} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Criar produção a partir do planejamento' }))
    await screen.findByRole('dialog', { name: 'Nova produção' })
    expect(router.state.location.pathname).toBe('/producer/production')
    expect((screen.getByLabelText('Quantidade prevista (kg)') as HTMLInputElement).value).toBe('1000')
    expect((screen.getByLabelText('Produto agrícola') as HTMLSelectElement).value).toBe('tomate-italiano')
    expect(screen.getByText(/Planejamento: Região de Campinas/)).toBeTruthy()
    expect(await domainDatabase.snapshot()).toEqual(before)
    click('Confirmar produção'); await screen.findByText('Produção salva com sucesso.')
    await screen.findByRole('table')
    fireEvent.click(within(row('Tomate Italiano')).getByRole('button', { name: 'Criar oferta' }))
    expect((screen.getByLabelText('Preço por kg (R$)') as HTMLInputElement).value).toBe('5.5')
  })
  it('ignores handoffs for a different organization', async () => {
    const router = createMemoryRouter([{ path: '/producer/production', element: <ProductionPage /> }], { initialEntries: [{ pathname: '/producer/production', state: planningHandoff('another') }] })
    render(<RouterProvider router={router} />)
    await screen.findByRole('table')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('handles a missing simulation without creating anything', async () => {
    const router = createMemoryRouter([{ path: '/producer/production', element: <ProductionPage /> }], { initialEntries: [{ pathname: '/producer/production', state: planningHandoff('santa-clara') }] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByText(/O planejamento não está mais disponível/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('refreshes the table after an external commercial command', async () => {
    await mount()
    await act(async () => { await commercialService.createProduction('santa-clara', { productId: 'cenoura', estimatedQuantityKg: 10, harvestedQuantityKg: 0, expectedHarvestDate: '2026-11-25', status: 'growing' }) })
    expect(await screen.findByText('Cenoura')).toBeTruthy()
  })
})
