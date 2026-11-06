import { create } from 'zustand'
import { domainDatabase } from '@/services/domain'
import { DOMAIN_STORAGE_KEY, type InitializationStatus } from '@/repositories/local/domain-database'

interface DomainState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  revision: number
  initialization: InitializationStatus | null
  error: string | null
}
// Only synchronization metadata lives in Zustand. Repositories remain the data authority.
export const useDomainStore = create<DomainState>(() => ({ status: 'idle', revision: 0, initialization: null, error: null }))
domainDatabase.subscribe(() => useDomainStore.setState((state) => ({ revision: state.revision + 1, status: 'ready', error: null })))
let pendingInitialization: Promise<void> | null = null
export function initializeDomain(): Promise<void> {
  if (pendingInitialization) return pendingInitialization
  useDomainStore.setState({ status: 'loading', error: null })
  pendingInitialization = domainDatabase.initialize().then((initialization) => {
    useDomainStore.setState((state) => ({ status: 'ready', initialization, error: null, revision: state.revision + 1 }))
  }).catch((error: unknown) => {
    useDomainStore.setState({ status: 'error', error: error instanceof Error ? error.message : 'Falha na inicialização do cenário.' })
  }).finally(() => { pendingInitialization = null })
  return pendingInitialization
}
export function connectDomainStorageEvents() {
  const listener = (event: StorageEvent) => {
    if (event.key === DOMAIN_STORAGE_KEY || event.key === null) void initializeDomain()
  }
  window.addEventListener('storage', listener)
  return () => window.removeEventListener('storage', listener)
}
