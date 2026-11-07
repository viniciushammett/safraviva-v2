import { create } from 'zustand'
import { supplierFavoritesRepository } from '@/services/domain'
import { SUPPLIER_FAVORITES_KEY } from '@/repositories/supplier-favorites-repository'
// Only invalidation metadata; persisted favorite IDs stay in their repository.
export const useSupplierFavoritesStore = create<{ revision: number }>(() => ({ revision: 0 }))
const invalidate = () => useSupplierFavoritesStore.setState((s) => ({ revision: s.revision + 1 }))
supplierFavoritesRepository.subscribe(invalidate)
export function connectSupplierFavoritesEvents() {
  const listener = (event: StorageEvent) => { if (event.key === SUPPLIER_FAVORITES_KEY || event.key === null) invalidate() }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
