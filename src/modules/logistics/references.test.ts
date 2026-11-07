import { describe, expect, it } from 'vitest'
import { logisticsReference } from './references'
describe('display references', () => {
  const id = 'aba24776-8d33-4d75-9d6a-08a622b9d46d'
  it('provides a stable compact label for full UUIDs', () => {
    const label = logisticsReference(id)
    expect(label).toMatch(/^Pedido [A-Z0-9]{7}$/)
    expect(label).toBe(logisticsReference(id))
    expect(label).not.toContain(id)
    expect(label).not.toBe(logisticsReference('aba24776-8d33-4d75-9d6a-08a622b9d46e'))
  })
  it('distinguishes an operation from an order without changing the original ID', () => {
    expect(logisticsReference(id, 'operation')).toMatch(/^Frete [A-Z0-9]{7}$/)
    expect(id).toBe('aba24776-8d33-4d75-9d6a-08a622b9d46d')
  })
})
