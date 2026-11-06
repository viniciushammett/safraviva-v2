import { describe, expect, it } from 'vitest'
import { CommercialService } from './commercial-service'
import { LocalDomainDatabase } from '@/repositories/local/domain-database'
async function setup() {
  const values = new Map<string, string>()
  const db = new LocalDomainDatabase({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } })
  await db.initialize()
  let id = 0
  let now = '2026-11-06T12:00:00.000Z'
  const service = new CommercialService(db, { now: () => now, id: () => `availability-${++id}` })
  return { db, service, advance: () => { now = '2026-11-26T12:00:00.000Z' } }
}
describe('future availability command validation', () => {
  it.each(['2026-11-01', '2026-11-06'])('rejects nonfuture date %s without mutation', async (availableFrom) => {
    const { db, service } = await setup()
    const before = await db.snapshot()
    await expect(service.createOffer('santa-clara', { productionId: 'prod-tomate-sc', quantityKg: 10, pricePerKg: 5, availabilityType: 'future', availableFrom })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await db.snapshot()).toEqual(before)
  })
  it('checks future dates again when publishing and editing', async () => {
    const { db, service, advance } = await setup()
    const offer = await service.createOffer('santa-clara', { productionId: 'prod-milho-sc', quantityKg: 10, pricePerKg: 5, availabilityType: 'future', availableFrom: '2026-11-25' })
    advance()
    const before = await db.snapshot()
    await expect(service.publishOffer('santa-clara', offer.id)).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.editOffer('santa-clara', offer.id, { pricePerKg: 6 })).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(await db.snapshot()).toEqual(before)
  })
})
