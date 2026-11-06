import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { commercialService, domainDatabase, domainQueryService, restoreInitialScenario } from '@/services/domain'
import { DOMAIN_STORAGE_KEY } from '@/repositories/local/domain-database'
import { connectDomainStorageEvents, initializeDomain, useDomainStore } from '@/stores/domain/domain-store'
import { useDomainQuery } from '@/stores/domain/use-domain-query'
import { useWorkspaceStore } from '@/stores/workspace-store'

beforeEach(() => {
  localStorage.clear()
  useDomainStore.setState({ status: 'idle', revision: 0, error: null, initialization: null })
})
afterEach(cleanup)
it('bootstraps once without changing the existing active workspace', async () => {
  useWorkspaceStore.getState().selectWorkspace('bom-preco')
  const workspace = localStorage.getItem('safraviva-workspace')
  const first = initializeDomain()
  expect(initializeDomain()).toBe(first)
  await first
  expect(useDomainStore.getState()).toMatchObject({ status: 'ready', initialization: 'created' })
  await restoreInitialScenario({ confirmed: true })
  expect(localStorage.getItem('safraviva-workspace')).toBe(workspace)
  expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('bom-preco')
})
it('invalidates domain queries after a successful command without storing entities in Zustand', async () => {
  await initializeDomain()
  const query = () => domainQueryService.availableOffers()
  const { result } = renderHook(() => useDomainQuery(query))
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.data?.find((row) => row.id === 'offer-tomate')?.availableQuantityKg).toBe(950)
  await act(async () => { await commercialService.confirmOrder('santa-clara', 'order-pending') })
  await waitFor(() => expect(result.current.data?.find((row) => row.id === 'offer-tomate')?.availableQuantityKg).toBe(750))
  expect(Object.keys(useDomainStore.getState()).sort()).toEqual(['error', 'initialization', 'revision', 'status'])
})
it('reports storage initialization errors and recovers after explicitly confirmed restoration', async () => {
  localStorage.setItem(DOMAIN_STORAGE_KEY, JSON.stringify({ schemaVersion: 99, data: {} }))
  await initializeDomain()
  expect(useDomainStore.getState().status).toBe('error')
  await restoreInitialScenario({ confirmed: true })
  expect(useDomainStore.getState()).toMatchObject({ status: 'ready', error: null })
})
it('refreshes on another tab storage events and provides cleanup', async () => {
  await initializeDomain()
  const disconnect = connectDomainStorageEvents()
  const revision = useDomainStore.getState().revision
  window.dispatchEvent(new StorageEvent('storage', { key: DOMAIN_STORAGE_KEY }))
  await waitFor(() => expect(useDomainStore.getState().revision).toBeGreaterThan(revision))
  disconnect()
  const after = useDomainStore.getState().revision
  window.dispatchEvent(new StorageEvent('storage', { key: DOMAIN_STORAGE_KEY }))
  expect(useDomainStore.getState().revision).toBe(after)
})
it('exposes query failures without an unhandled rejection', async () => {
  await domainDatabase.initialize()
  await initializeDomain()
  const query = async (): Promise<never> => { throw new Error('Consulta indisponível') }
  const { result } = renderHook(() => useDomainQuery(query))
  await waitFor(() => expect(result.current.error).toBe('Consulta indisponível'))
  expect(result.current.loading).toBe(false)
})
