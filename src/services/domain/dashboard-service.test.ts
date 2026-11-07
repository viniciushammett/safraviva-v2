import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { addLogisticsReferenceScenario } from '@/data/logistics-demo'
import { DashboardService } from './dashboard-service'
import { MarketIntelligenceService } from './market-intelligence-service'
const clock = { now: () => '2026-11-06T12:00:00.000Z' }
function setup() { const data = createInitialScenario(); return { data, service: new DashboardService({ snapshot: async () => structuredClone(data) }, clock) } }
describe('dashboard service', () => {
  it('returns producer indicators, recent orders and actual engine recommendations', async () => {
    const { data, service } = setup(); const overview = await service.overview('santa-clara', 30)
    expect(overview.indicators).toMatchObject({ completedAmount: 0, pendingCount: 2, inProgressCount: 2, availableProductionKg: 6550 })
    expect(overview.recentOrders).toHaveLength(5)
    expect(overview.recentOrders.every((o) => o.producerOrganizationId === 'santa-clara')).toBe(true)
    expect(overview.recommendations.length).toBeLessThanOrEqual(3)
    for (const result of overview.recommendations) expect(result).toEqual(await new MarketIntelligenceService({ snapshot: async () => data }).query({ productId: result.product.id, region: result.analysis.region, periodDays: 30 }))
  })
  it('returns buyer indicators and prioritizes same-city supplier offers', async () => {
    const { service } = setup(); const overview = await service.overview('bom-preco', 7)
    expect(overview.indicators).toMatchObject({ activeSuppliers: 2, pendingCount: 2, inProgressCount: 1 })
    expect(overview.supplyOpportunities[0].region).toBe('Campinas/SP')
    expect(overview.supplyOpportunities.every((o) => o.status === 'published' && o.availableQuantityKg > 0)).toBe(true)
    expect(overview.recommendations).toEqual([])
  })
  it('limits recommendations and does not write scenario data', async () => {
    const { data, service } = setup(); const before = structuredClone(data)
    await service.overview('santa-clara', 90)
    expect(data).toEqual(before)
  })
  it('includes actual consolidation opportunities when available', async () => {
    const { data, service } = setup(); addLogisticsReferenceScenario(data, clock.now())
    expect((await service.overview('santa-clara', 30)).alerts?.logisticsOpportunities).toBeGreaterThan(0)
  })
  it('handles lack of market data without fabricating recommendations', async () => {
    const { data, service } = setup(); data.marketAnalyses = []
    expect((await service.overview('santa-clara', 30)).recommendations).toEqual([])
  })
  it.each(['unknown', 'rotas-do-campo'])('denies invalid dashboard organization %s', async (id) => {
    await expect(setup().service.overview(id, 7)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
