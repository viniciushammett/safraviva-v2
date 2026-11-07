import { describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { addLogisticsReferenceScenario } from '@/data/logistics-demo'
import { compareFreight, consolidationOpportunities, geographicDistanceKm, LOGISTICS_CONFIG, quoteLoads } from './logistics-planning'
import { deliveryInformationSchema } from './logistics-schemas'
const today = '2026-11-06'
export function referenceData() { const data = createInitialScenario(); addLogisticsReferenceScenario(data, `${today}T12:00:00.000Z`); return data }
function sample() {
  const data = referenceData()
  return { data, orders: data.orders.filter((o) => o.id.startsWith('reference-4a-order-')), partner: data.organizations.find((o) => o.id === 'rotas-do-campo')! }
}
describe('logistics calculations and compatibility', () => {
  it('compares individual and shared costs and allocates all cents by weight', () => {
    const cost = compareFreight([200, 150, 250], [30, 30, 30], 1000)
    expect(cost.individualCost).toBe(630)
    expect(cost.sharedCost).toBe(223.5)
    expect(cost.savingsAbsolute).toBe(406.5)
    expect(cost.savingsPercent).toBeCloseTo(64.5238)
    expect(cost.utilizationPercent).toBe(60)
    expect(cost.shares.reduce((a, b) => a + b, 0)).toBeCloseTo(cost.sharedCost)
  })
  it('reports no advantage when sharing is more expensive', () => {
    const cost = compareFreight([100, 100], [1, 100], 1000, { ...LOGISTICS_CONFIG, fixedTripCost: 0, sharedDistanceFactor: 3 })
    expect(cost.hasEconomicAdvantage).toBe(false); expect(cost.savingsAbsolute).toBe(0); expect(cost.savingsPercent).toBe(0)
  })
  it('handles zero total cost without division by zero', () => expect(compareFreight([1], [1], 10, { ...LOGISTICS_CONFIG, fixedTripCost: 0, costPerKm: 0 }).savingsPercent).toBeNull())
  it.each([0, -1, NaN, Infinity])('rejects invalid weights %s', (n) => expect(() => compareFreight([n], [1], 100)).toThrow())
  it.each([0, -1, NaN, Infinity])('rejects invalid distances %s', (n) => expect(() => compareFreight([1], [n], 100)).toThrow())
  it.each([0, -1, NaN, Infinity])('rejects invalid capacity %s', (n) => expect(() => compareFreight([1], [1], n)).toThrow())
  it('rejects negative cost parameters and excessive weight', () => {
    expect(() => compareFreight([1], [1], 100, { ...LOGISTICS_CONFIG, costPerKm: -1 })).toThrow()
    expect(() => compareFreight([100, 101], [1, 1], 200)).toThrow()
  })
  it('identifies multi-producer opportunities without authorizing participants', () => {
    const { data } = sample()
    const results = consolidationOpportunities(data, 'santa-clara', today)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].producerIds).toContain('boa-esperanca')
    expect(results[0].requiresOtherProducers).toBe(true)
    expect(results).toEqual(consolidationOpportunities(data, 'santa-clara', today))
  })
  it('requires logistics information before recommending a group', () => {
    const { data, orders, partner } = sample(); delete orders[0].delivery
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Complete os dados/)
  })
  it('requires reference coordinates for shared recommendations', () => {
    const { data, orders, partner } = sample(); delete orders[0].delivery!.origin.coordinates
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Coordenadas/)
    expect(quoteLoads(data, [orders[0]], partner, 'individual', today).transportMode).toBe('individual')
  })
  it('rejects incompatible origins', () => {
    const { data, orders, partner } = sample(); orders[1].delivery!.origin.coordinates!.latitude = -10
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Origens distantes/)
  })
  it('rejects incompatible destinations', () => {
    const { data, orders, partner } = sample(); orders[1].delivery!.destination.coordinates!.longitude = -30
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Destinos distantes/)
  })
  it('rejects nonoverlapping delivery windows', () => {
    const { data, orders, partner } = sample(); orders[1].delivery!.windowStart = '2026-12-01'; orders[1].delivery!.windowEnd = '2026-12-02'
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/não se sobrepõem/)
  })
  it('rejects vehicle restrictions and unavailable partners', () => {
    const { data, orders, partner } = sample(); orders[0].delivery!.restrictions = ['refrigerated']
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Restrições/)
    partner.logisticsProfile!.available = false
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/disponibilidade/)
  })
  it('rejects service regions outside partner coverage', () => {
    const { data, orders, partner } = sample(); orders[0].delivery!.destination.state = 'MG'
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/região de atendimento/)
  })
  it('rejects active assignments and duplicate selections', () => {
    const { data, orders, partner } = sample(); data.logistics[0].orderIds.push(orders[0].id)
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/associado/)
    expect(() => quoteLoads(data, [orders[1], orders[1]], partner, 'shared', today)).toThrow(/distintos/)
  })
  it('rejects inconsistent weight, expired dates and wrong modality', () => {
    const { data, orders, partner } = sample()
    expect(() => quoteLoads(data, orders, partner, 'individual', today)).toThrow()
    orders[0].delivery!.weightKg = 1
    expect(() => quoteLoads(data, orders, partner, 'shared', today)).toThrow(/Peso/)
    orders[0].delivery!.weightKg = orders[0].quantityKg
    expect(() => quoteLoads(data, orders, partner, 'shared', '2027-01-01')).toThrow(/janela/)
  })
  it('computes reference distances without claiming road routing', () => {
    const point = { latitude: -22.9, longitude: -47.06, source: 'synthetic' as const }
    expect(geographicDistanceKm(point, point)).toBe(0)
    expect(geographicDistanceKm(point, { ...point, latitude: -22.91 })).toBeCloseTo(1.1119)
  })
  it.each([
    { destination: { label: '', city: 'Campinas', state: 'SP' } },
    { windowStart: '2026-11-20', windowEnd: '2026-11-10' },
    { windowStart: '2026-02-30' },
    { referenceDistanceKm: 0 },
    { restrictions: ['ambient', 'refrigerated'] },
  ])('validates logistics input %j', (patch) => {
    expect(deliveryInformationSchema.safeParse({ ...sample().orders[0].delivery, ...patch }).success).toBe(false)
  })
})
