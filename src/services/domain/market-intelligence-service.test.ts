import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { validateDomainData } from '@/domain/integrity'
import { demandGapKg, demandSupplyRatio, potentialGrossRevenue, priceDifferencePercent, recommendMarket } from '@/domain/market-intelligence'
import { MarketIntelligenceService } from './market-intelligence-service'
import { createProductionSchema } from '@/domain/schemas'
import { LocalDomainDatabase } from '@/repositories/local/domain-database'

const region = 'Região de Campinas/SP'
const query = { productId: 'tomate-italiano', region, periodDays: 7 }
const plan = { productId: 'tomate-italiano', region, plannedQuantityKg: 100, expectedHarvestDate: '2026-11-25', desiredPricePerKg: 4.5 }
function setup() {
  const data = createInitialScenario()
  return { data, service: new MarketIntelligenceService({ snapshot: async () => structuredClone(data) }) }
}
describe('market intelligence queries', () => {
  it('returns existing analysis, product, methodology and chart indicators', async () => {
    const { service } = setup()
    expect(await service.query(query)).toMatchObject({ status: 'available', product: { name: 'Tomate Italiano' }, analysis: { periodDays: 7, estimatedDemandKg: 1680 }, indicators: { demandGapKg: 280, demandSupplyRatio: 1.2, demandSupplyPercent: 120 } })
  })
  it.each([
    [{ productId: 'missing' }, 'product_not_found'],
    [{ region: 'missing' }, 'region_not_found'],
    [{ periodDays: 8 }, 'invalid_period'],
    [{ productId: 'milho', periodDays: 7 }, 'no_data'],
  ])('returns typed unavailability for %j', async (patch, reason) => {
    expect(await setup().service.query({ ...query, ...patch })).toEqual({ status: 'unavailable', reason })
  })
  it('rejects unusable reference and empty volumes', async () => {
    const { data, service } = setup()
    const row = data.marketAnalyses.find((a) => a.productId === query.productId && a.periodDays === 7)!
    row.referencePricePerKg = 0
    expect(await service.query(query)).toEqual({ status: 'unavailable', reason: 'insufficient_data' })
    row.referencePricePerKg = 4.5; row.estimatedDemandKg = 0; row.estimatedSupplyKg = 0
    expect(await service.query(query)).toEqual({ status: 'unavailable', reason: 'insufficient_data' })
  })
  it('selects latest exact analysis deterministically', async () => {
    const { data, service } = setup()
    const row = data.marketAnalyses.find((a) => a.productId === query.productId && a.periodDays === 7)!
    data.marketAnalyses.push({ ...row, id: 'new', calculatedAt: '2026-11-05T00:00:00.000Z', referencePricePerKg: 5 })
    expect(await service.query(query)).toMatchObject({ analysis: { id: 'new', referencePricePerKg: 5 } })
  })
})
describe('pure indicators', () => {
  it.each([[100, 80, 20], [80, 100, -20], [100, 100, 0]])('gap %s %s', (d, s, result) => expect(demandGapKg(d, s)).toBe(result))
  it('calculates ratio', () => expect(demandSupplyRatio(120, 100)).toBe(1.2))
  it.each([0, 100])('handles zero supply for demand %s', (d) => expect(demandSupplyRatio(d, 0)).toBeNull())
  it.each([[5, 4, 25], [3, 4, -25], [4, 4, 0]])('price difference %s %s', (d, r, result) => expect(priceDifferencePercent(d, r)).toBe(result))
  it('rejects zero reference price', () => expect(() => priceDifferencePercent(5, 0)).toThrow())
  it('rounds gross revenue using commercial convention', () => expect(potentialGrossRevenue(1.125, 4.5)).toBe(5.06))
  it.each([NaN, Infinity, -1])('rejects invalid arithmetic %s', (n) => {
    expect(() => demandSupplyRatio(n, 1)).toThrow()
    expect(() => demandGapKg(1, n)).toThrow()
    expect(() => potentialGrossRevenue(n, 1)).toThrow()
    expect(() => priceDifferencePercent(n, 1)).toThrow()
  })
})
describe('recommendation and risk rules', () => {
  const base = createInitialScenario().marketAnalyses[0]
  it.each([
    [120, 100, 'growing', 4.5, 'opportunity', 'low'],
    [100, 100, 'stable', 4.5, 'balanced', 'moderate'],
    [80, 100, 'declining', 4.5, 'oversupply', 'high'],
    [120, 100, 'growing', 4.6, 'opportunity', 'moderate'],
    [120, 100, 'growing', 5, 'opportunity', 'high'],
    [120, 100, 'declining', 4.5, 'balanced', 'moderate'],
    [110, 100, 'stable', 4.5, 'opportunity', 'low'],
    [90, 100, 'stable', 4.5, 'oversupply', 'high'],
    [100, 0, 'growing', 4.5, 'opportunity', 'low'],
  ] as const)('classifies %s/%s %s at %s', (demand, supply, trend, price, condition, risk) => {
    expect(recommendMarket({ ...base, estimatedDemandKg: demand, estimatedSupplyKg: supply, trend }, price)).toMatchObject({ condition, risk })
  })
  it('reports missing data', () => expect(recommendMarket(null)).toMatchObject({ condition: 'insufficient_data', risk: 'insufficient_data' }))
  it('includes horizon and price guidance', () => expect(recommendMarket(base, 5).recommendation).toContain('30 dias'))
})
describe('consultative planning and fixtures', () => {
  it('simulates revenue and a compatible production draft', async () => {
    const result = await setup().service.simulate(plan)
    expect(result).toMatchObject({ potentialGrossRevenue: 450, referencePricePerKg: 4.5, priceDifferencePercent: 0, risk: 'low' })
    expect(createProductionSchema.safeParse(result.productionDraft).success).toBe(true)
  })
  it.each([
    { plannedQuantityKg: 0 }, { plannedQuantityKg: -1 }, { plannedQuantityKg: NaN }, { plannedQuantityKg: 0.0001 },
    { desiredPricePerKg: 0 }, { desiredPricePerKg: -1 }, { desiredPricePerKg: Infinity }, { desiredPricePerKg: 1.001 },
    { expectedHarvestDate: 'invalid' }, { expectedHarvestDate: '2026-02-30' },
  ])('validates plan %j', async (patch) => {
    await expect(setup().service.simulate({ ...plan, ...patch })).rejects.toMatchObject({ code: 'VALIDATION' })
  })
  it('simulates with unavailable market without fabricating prices', async () => {
    expect(await setup().service.simulate({ ...plan, productId: 'missing' })).toMatchObject({ referencePricePerKg: null, priceDifferencePercent: null, condition: 'insufficient_data', risk: 'insufficient_data' })
  })
  it('never writes persisted commercial state', async () => {
    const values = new Map<string, string>()
    let writes = 0
    const db = new LocalDomainDatabase({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { writes++; values.set(key, value) } })
    await db.initialize()
    const before = await db.snapshot()
    const count = writes
    await new MarketIntelligenceService(db).simulate(plan)
    expect(await db.snapshot()).toEqual(before)
    expect(writes).toBe(count)
  })
  it('retains Sprint 2A records and schema compatibility', () => {
    const data = createInitialScenario()
    expect(validateDomainData(data)).toEqual(data)
    expect(data.products.find((p) => p.id === 'tomate')?.name).toBe('Tomate')
    expect(data.marketAnalyses.find((a) => a.id === 'analysis-batata')).toMatchObject({ estimatedDemandKg: 7000, estimatedSupplyKg: 6700 })
  })
  it.each(['tomate-italiano', 'alface-crespa', 'cenoura', 'batata'])('has consistent cumulative synthetic windows for %s', (id) => {
    const rows = createInitialScenario().marketAnalyses.filter((a) => a.productId === id).sort((a, b) => a.periodDays - b.periodDays)
    expect(rows.map((a) => a.periodDays)).toEqual([7, 15, 30])
    for (const row of rows) {
      expect(row.methodology).toContain('sintético')
      expect(row.calculatedAt).toBe(rows[0].calculatedAt)
      expect(row.trend).toBe(rows[0].trend)
      expect(row.estimatedDemandKg / row.periodDays).toBeCloseTo(rows[0].estimatedDemandKg / 7, 3)
      expect(row.estimatedSupplyKg / row.periodDays).toBeCloseTo(rows[0].estimatedSupplyKg / 7, 3)
    }
    expect(rows[0].estimatedSupplyKg).toBeLessThan(rows[1].estimatedSupplyKg)
    expect(rows[1].estimatedDemandKg).toBeLessThan(rows[2].estimatedDemandKg)
  })
})
