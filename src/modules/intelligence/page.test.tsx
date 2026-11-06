import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { IntelligencePage } from './page'
import { useIntelligenceSession } from './session-store'
import { initializeDomain } from '@/stores/domain/domain-store'
import { domainDatabase, marketIntelligenceService } from '@/services/domain'

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>()
  return { ...actual, ResponsiveContainer: ({ children }: { children: React.ReactElement }) => <actual.ResponsiveContainer width={600} height={288}>{children}</actual.ResponsiveContainer> }
})
function change(label: string, value: string) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
async function mount() {
  render(<IntelligencePage />)
  await screen.findByLabelText('Produto agrícola')
}
function selectMarket(product = 'tomate-italiano', period = '7') {
  change('Produto agrícola', product); change('Região', 'Região de Campinas/SP'); change('Período de análise', period)
}
async function analyze(product = 'tomate-italiano', period = '7') {
  selectMarket(product, period)
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar análise' }))
  await screen.findByRole('heading', { name: 'Demanda e oferta estimadas' })
}
function fillPlan() {
  change('Produto do planejamento', 'tomate-italiano'); change('Região do planejamento', 'Região de Campinas/SP')
  change('Quantidade planejada (kg)', '100'); change('Data estimada de colheita', '2026-11-25'); change('Preço desejado (R$/kg)', '4.5')
}
async function simulate() {
  fillPlan(); fireEvent.click(screen.getByRole('button', { name: 'Simular planejamento' }))
  return screen.findByRole('region', { name: 'Resultado da simulação' })
}
beforeEach(async () => {
  localStorage.clear()
  useIntelligenceSession.setState({ filters: { productId: '', region: '', periodDays: 30 }, analysis: null, plan: {}, simulation: null })
  await initializeDomain()
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('intelligence page', () => {
  it('renders heading and initial state without invented indicators', async () => {
    await mount()
    expect(screen.getByRole('heading', { name: 'Inteligência de Mercado' })).toBeTruthy()
    expect(screen.getByText('Consulte o mercado da sua região')).toBeTruthy()
    expect(screen.queryByText('Demanda estimada')).toBeNull()
  })
  it('loads products and regions from the persisted scenario', async () => {
    await mount()
    expect(within(screen.getByLabelText('Produto agrícola')).getByRole('option', { name: 'Tomate Italiano' })).toBeTruthy()
    expect(within(screen.getByLabelText('Região')).getByRole('option', { name: 'Região de Campinas/SP' })).toBeTruthy()
  })
  it('updates filter selections and queries the service explicitly', async () => {
    const spy = vi.spyOn(marketIntelligenceService, 'query')
    await mount(); selectMarket('cenoura', '15')
    expect(spy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar análise' }))
    await screen.findByText('Excesso de oferta')
    expect(spy).toHaveBeenCalledWith({ productId: 'cenoura', region: 'Região de Campinas/SP', periodDays: 15 })
  })
  it('shows indicators and recommendations returned by the engine', async () => {
    await mount(); await analyze()
    expect(screen.getByText('1.680 kg')).toBeTruthy()
    expect(screen.getByText('1.400 kg')).toBeTruthy()
    expect(screen.getByText(/R\$\s*4,50\/kg/)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Oportunidade' })).toBeTruthy()
    expect(screen.getByText('280 kg')).toBeTruthy()
    expect(screen.getByText('120%')).toBeTruthy()
    expect(screen.getByText(/Considere negociar o volume/)).toBeTruthy()
  })
  it('renders actual aggregate bars and accessible comparison', async () => {
    await mount(); await analyze()
    expect(screen.getByRole('figure', { name: 'Comparativo de demanda e oferta em 7 dias' })).toBeTruthy()
    await waitFor(() => expect(document.querySelectorAll('.recharts-bar').length).toBe(2))
    expect(screen.getByText(/Valores agregados: demanda 1.680 kg e oferta 1.400 kg/)).toBeTruthy()
  })
  it('shows full methodology and reference date', async () => {
    await mount(); await analyze()
    fireEvent.click(screen.getByText('Análise baseada em cenário de referência · metodologia'))
    expect(screen.getByText(/Taxas diárias fixas/)).toBeTruthy()
    expect(screen.getByText(/Referência: 04\/11\/2026/)).toBeTruthy()
  })
  it('clears the displayed analysis when filters change', async () => {
    await mount(); await analyze(); change('Período de análise', '15')
    expect(screen.queryByText('1.680 kg')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar análise' }))
    await screen.findByText('3.600 kg', { selector: 'dd' })
  })
  it('shows unavailability without chart or indicators', async () => {
    await mount(); selectMarket('milho', '7')
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar análise' }))
    await screen.findByRole('heading', { name: 'Análise indisponível' })
    expect(screen.queryByRole('figure')).toBeNull()
  })
  it('handles read failures visibly', async () => {
    vi.spyOn(marketIntelligenceService, 'query').mockRejectedValue(new Error('Falha de leitura'))
    await mount(); selectMarket(); fireEvent.click(screen.getByRole('button', { name: 'Atualizar análise' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Falha de leitura')
  })
  it.each([
    ['Quantidade planejada (kg)', '0', /Informe uma quantidade positiva/],
    ['Quantidade planejada (kg)', '-2', /Informe uma quantidade positiva/],
    ['Preço desejado (R$/kg)', '0', /Informe um preço positivo/],
    ['Preço desejado (R$/kg)', '1.001', /Informe um preço positivo/],
    ['Data estimada de colheita', '', /Informe uma data de colheita válida/],
  ])('validates %s with %s', async (label, value, message) => {
    const spy = vi.spyOn(marketIntelligenceService, 'simulate')
    await mount(); fillPlan(); change(label, value)
    fireEvent.click(screen.getByRole('button', { name: 'Simular planejamento' }))
    expect(await screen.findByText(message)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
  it('simulates revenue, comparison and low risk using the service', async () => {
    const spy = vi.spyOn(marketIntelligenceService, 'simulate')
    await mount(); const result = await simulate()
    expect(spy).toHaveBeenCalledWith({ productId: 'tomate-italiano', region: 'Região de Campinas/SP', plannedQuantityKg: 100, expectedHarvestDate: '2026-11-25', desiredPricePerKg: 4.5 })
    expect(within(result).getByText(/R\$\s*450,00/)).toBeTruthy()
    expect(within(result).getByText('Baixo')).toBeTruthy()
    expect(within(result).getByText('0%')).toBeTruthy()
    expect(within(result).getByText(/não é projeção para a colheita/)).toBeTruthy()
    expect(useIntelligenceSession.getState().simulation?.result.productionDraft.productId).toBe('tomate-italiano')
  })
  it.each([['6', 'Alto'], ['4.6', 'Moderado']])('shows risk for desired price %s', async (price, risk) => {
    await mount(); fillPlan(); change('Preço desejado (R$/kg)', price)
    fireEvent.click(screen.getByRole('button', { name: 'Simular planejamento' }))
    expect(await screen.findByText(risk)).toBeTruthy()
  })
  it('shows explicit unavailability for a plan without its 30-day reference', async () => {
    await domainDatabase.transaction((data) => { data.marketAnalyses = data.marketAnalyses.filter((a) => !(a.productId === 'tomate-italiano' && a.periodDays === 30)) })
    await mount(); const result = await simulate()
    expect(within(result).getAllByText('Indisponível').length).toBe(2)
    expect(within(result).getByText(/Análise indisponível para este plano/)).toBeTruthy()
    expect(within(result).getByText(/R\$\s*450,00/)).toBeTruthy()
  })
  it('handles simulation failure without claiming completion', async () => {
    vi.spyOn(marketIntelligenceService, 'simulate').mockRejectedValue(new Error('Falha ao consultar referência'))
    await mount(); fillPlan(); fireEvent.click(screen.getByRole('button', { name: 'Simular planejamento' }))
    expect((await screen.findByRole('alert')).textContent).toBe('Falha ao consultar referência')
    expect(screen.queryByRole('region', { name: 'Resultado da simulação' })).toBeNull()
  })
  it('handles an empty scenario without inventing product options', async () => {
    await domainDatabase.transaction((data) => { data.marketAnalyses = [] })
    await mount()
    expect(screen.getByText('Não há análises disponíveis no cenário atual.')).toBeTruthy()
    expect(within(screen.getByLabelText('Produto agrícola')).getAllByRole('option').length).toBe(1)
    expect((screen.getByRole('button', { name: 'Atualizar análise' }) as HTMLButtonElement).disabled).toBe(true)
  })
  it('never mutates commercial state during UI simulation', async () => {
    await mount(); const before = await domainDatabase.snapshot(); const bytes = localStorage.getItem('safraviva-domain')
    await simulate()
    expect(await domainDatabase.snapshot()).toEqual(before)
    expect(localStorage.getItem('safraviva-domain')).toBe(bytes)
  })
  it('preserves filters, form and complete result across page navigation', async () => {
    await mount(); await analyze(); await simulate()
    cleanup(); await mount()
    expect((screen.getByLabelText('Produto agrícola') as HTMLSelectElement).value).toBe('tomate-italiano')
    expect((screen.getByLabelText('Quantidade planejada (kg)') as HTMLInputElement).value).toBe('100')
    expect(screen.getByRole('region', { name: 'Resultado da simulação' })).toBeTruthy()
    expect(screen.getByText('1.680 kg')).toBeTruthy()
  })
  it('warns when retained results precede a domain revision', async () => {
    await mount(); await analyze(); await simulate()
    await act(async () => { await domainDatabase.transaction(() => undefined) })
    expect(await screen.findByText(/O cenário mudou/)).toBeTruthy()
    expect(screen.getByText(/O cenário foi atualizado/)).toBeTruthy()
  })
})
