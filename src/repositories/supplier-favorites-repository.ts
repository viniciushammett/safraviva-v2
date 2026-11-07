import { z } from 'zod'
import { DomainError } from '@/domain/errors'
import type { StoragePort } from '@/repositories/contracts/domain-repositories'
export const SUPPLIER_FAVORITES_KEY = 'safraviva-supplier-favorites'
const schema = z.object({ version: z.literal(1), buyers: z.record(z.string(), z.array(z.string().min(1))) }).strict()
const queues = new WeakMap<StoragePort, Promise<unknown>>()
export class SupplierFavoritesRepository {
  private listeners = new Set<() => void>()
  constructor(private readonly storage: StoragePort) {}
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private read() {
    let raw: string | null
    try { raw = this.storage.getItem(SUPPLIER_FAVORITES_KEY) } catch { throw new DomainError('STORAGE_UNAVAILABLE', 'Não foi possível ler os fornecedores favoritos.') }
    if (raw === null) return { version: 1 as const, buyers: {} as Record<string, string[]> }
    try { return schema.parse(JSON.parse(raw)) } catch { throw new DomainError('VALIDATION', 'Preferências de fornecedores inválidas. Os dados salvos foram preservados.') }
  }
  async list(buyerId: string) { const data = this.read(); return Object.hasOwn(data.buyers, buyerId) ? [...new Set(data.buyers[buyerId])] : [] }
  async set(buyerId: string, supplierId: string, favorite: boolean) {
    const previous = queues.get(this.storage) ?? Promise.resolve()
    const update = () => {
      const data = this.read()
      const current = Object.hasOwn(data.buyers, buyerId) ? data.buyers[buyerId] : []
      const ids = favorite ? [...new Set([...current, supplierId])] : current.filter((id) => id !== supplierId)
      const next = { version: 1, buyers: { ...data.buyers, [buyerId]: ids } }
      try { this.storage.setItem(SUPPLIER_FAVORITES_KEY, JSON.stringify(next)) } catch { throw new DomainError('STORAGE_UNAVAILABLE', 'Não foi possível salvar o favorito. Nenhuma alteração foi confirmada.') }
      for (const listener of this.listeners) listener()
      return ids
    }
    const pending = previous.catch(() => {}).then(() => typeof navigator !== 'undefined' && navigator.locks?.request ? navigator.locks.request(SUPPLIER_FAVORITES_KEY, update) : update())
    queues.set(this.storage, pending)
    return pending
  }
}
