import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialScenario } from '@/data/commercial-scenario'
import { SupplierFavoritesRepository, SUPPLIER_FAVORITES_KEY } from '@/repositories/supplier-favorites-repository'
import { SupplierFavoritesService } from './supplier-favorites-service'
let values: Map<string, string>
let repository: SupplierFavoritesRepository
let service: SupplierFavoritesService
beforeEach(() => {
  values = new Map(); repository = new SupplierFavoritesRepository({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } })
  service = new SupplierFavoritesService({ snapshot: async () => createInitialScenario() }, repository)
})
describe('supplier favorites', () => {
  it('adds, deduplicates, removes and persists favorites by buyer', async () => {
    await service.set('bom-preco', 'santa-clara', true); await service.set('bom-preco', 'santa-clara', true)
    expect(await service.list('bom-preco')).toEqual(['santa-clara'])
    expect(await service.list('restaurante-central')).toEqual([])
    const reload = new SupplierFavoritesRepository({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) } })
    expect(await reload.list('bom-preco')).toEqual(['santa-clara'])
    await service.set('bom-preco', 'santa-clara', false); expect(await service.list('bom-preco')).toEqual([])
  })
  it('retains different buyers and serializes concurrent changes', async () => {
    await Promise.all([service.set('bom-preco', 'santa-clara', true), service.set('bom-preco', 'boa-esperanca', true), service.set('restaurante-central', 'horizonte', true)])
    expect(await service.list('bom-preco')).toEqual(['santa-clara', 'boa-esperanca'])
    expect(await service.list('restaurante-central')).toEqual(['horizonte'])
  })
  it('validates the buyer and target supplier', async () => {
    await expect(service.set('santa-clara', 'horizonte', true)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(service.set('bom-preco', 'missing', true)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(service.list('missing')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('preserves malformed preference data instead of resetting it', async () => {
    values.set(SUPPLIER_FAVORITES_KEY, 'invalid')
    await expect(service.list('bom-preco')).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(service.set('bom-preco', 'santa-clara', true)).rejects.toMatchObject({ code: 'VALIDATION' })
    expect(values.get(SUPPLIER_FAVORITES_KEY)).toBe('invalid')
  })
  it('reports storage failures and notifies only confirmed writes', async () => {
    let notifications = 0; repository.subscribe(() => { notifications++ })
    await service.set('bom-preco', 'santa-clara', true); expect(notifications).toBe(1)
    const failed = new SupplierFavoritesRepository({ getItem: () => null, setItem: () => { throw new Error('Quota') } })
    await expect(failed.set('bom-preco', 'horizonte', true)).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' })
  })
})
