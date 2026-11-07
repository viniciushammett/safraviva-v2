import { migrateDomainV1 } from '@/repositories/local/domain-migrations'
import { createInitialScenario } from '@/data/commercial-scenario'
import { DomainError, invariant } from '@/domain/errors'
import { validateDomainData } from '@/domain/integrity'
import type { DomainData } from '@/types/domain'
import type { DomainUnitOfWork, StoragePort } from '@/repositories/contracts/domain-repositories'

export const DOMAIN_STORAGE_KEY = 'safraviva-domain'
export const DOMAIN_SCHEMA_VERSION = 2
export type InitializationStatus = 'created' | 'loaded' | 'recovered' | 'migrated'
interface Envelope { schemaVersion: number; initializedAt: string; data: DomainData }
const queues = new WeakMap<StoragePort, Promise<unknown>>()
export const browserDomainStorage: StoragePort = {
  getItem(key) { return localStorage.getItem(key) },
  setItem(key, value) { localStorage.setItem(key, value) },
}

export class LocalDomainDatabase implements DomainUnitOfWork {
  private listeners = new Set<() => void>()
  constructor(private readonly storage: StoragePort, readonly key = DOMAIN_STORAGE_KEY) {}

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private notify() { for (const listener of this.listeners) listener() }
  private exclusive<T>(action: () => T | Promise<T>): Promise<T> {
    const previous = queues.get(this.storage) ?? Promise.resolve()
    const next = previous.catch(() => {}).then(async () => {
      // Web Locks coordinates read/validate/write across browser tabs on supporting browsers.
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request(`safraviva:${this.key}`, action)
      }
      return action()
    })
    queues.set(this.storage, next)
    return next
  }
  private readRaw(key = this.key) {
    try { return this.storage.getItem(key) }
    catch { throw new DomainError('STORAGE_UNAVAILABLE', 'Não foi possível ler o cenário local.') }
  }
  private write(key: string, value: string) {
    try { this.storage.setItem(key, value) }
    catch { throw new DomainError('STORAGE_UNAVAILABLE', 'Não foi possível persistir a operação. Nenhuma alteração foi confirmada.') }
  }
  private parse(raw: string): Envelope {
    const envelope: unknown = JSON.parse(raw)
    invariant(typeof envelope === 'object' && envelope !== null, 'VALIDATION', 'Cenário inválido.')
    const value = envelope as Partial<Envelope>
    invariant(typeof value.schemaVersion === 'number' && Number.isInteger(value.schemaVersion) && value.schemaVersion > 0, 'VALIDATION', 'Versão do cenário inválida.')
    invariant(value.schemaVersion === DOMAIN_SCHEMA_VERSION, 'INCOMPATIBLE_SCHEMA', 'Versão do cenário incompatível. Restaure explicitamente ou migre os dados antes de continuar.')
    invariant(typeof value.initializedAt === 'string' && Number.isFinite(Date.parse(value.initializedAt)), 'VALIDATION', 'Data de inicialização inválida.')
    return { schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: value.initializedAt, data: validateDomainData(value.data) }
  }
  private seed(): Envelope {
    return { schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: new Date().toISOString(), data: validateDomainData(createInitialScenario()) }
  }
  async initialize(): Promise<InitializationStatus> {
    return this.exclusive(() => {
      const raw = this.readRaw()
      if (raw === null) {
        this.write(this.key, JSON.stringify(this.seed()))
        this.notify()
        return 'created'
      }
      let legacy: { schemaVersion?: number; initializedAt?: string; data?: unknown } | null = null
      try { legacy = JSON.parse(raw) as { schemaVersion?: number; initializedAt?: string; data?: unknown } | null } catch { /* Existing recovery handles malformed JSON. */ }
      if (legacy?.schemaVersion === 1) {
        // A failed migration never enters recovery and never replaces the user's scenario.
        let migrated: Envelope
        try {
          invariant(typeof legacy.initializedAt === 'string' && Number.isFinite(Date.parse(legacy.initializedAt)), 'VALIDATION', 'Data de inicialização inválida.')
          migrated = { schemaVersion: DOMAIN_SCHEMA_VERSION, initializedAt: legacy.initializedAt, data: migrateDomainV1(legacy.data) }
        } catch { throw new DomainError('INCOMPATIBLE_SCHEMA', 'Não foi possível migrar o cenário anterior. Os dados originais foram preservados.') }
        if (this.readRaw() !== raw) throw new DomainError('CONFLICT', 'Cenário alterado durante a migração.')
        if (this.readRaw(`${this.key}.migration-v1`) === null) this.write(`${this.key}.migration-v1`, raw)
        this.write(this.key, JSON.stringify(migrated))
        this.notify()
        return 'migrated'
      }
      try { this.parse(raw); return 'loaded' }
      catch (error) {
        if (error instanceof DomainError && error.code === 'INCOMPATIBLE_SCHEMA') throw error
        // Keep the original bytes before repairing malformed/current-version data.
        this.write(`${this.key}.recovery`, raw)
        this.write(this.key, JSON.stringify(this.seed()))
        this.notify()
        return 'recovered'
      }
    })
  }
  private load(): Envelope {
    const raw = this.readRaw()
    invariant(raw !== null, 'NOT_FOUND', 'Cenário não inicializado.')
    return this.parse(raw)
  }
  async snapshot(): Promise<DomainData> {
    return this.exclusive(() => this.load().data)
  }
  async transaction<T>(command: (draft: DomainData) => T): Promise<T> {
    return this.exclusive(() => {
      const envelope = this.load()
      const result = command(envelope.data)
      // Commands must be synchronous: no external work between validation and commit.
      invariant(!(result instanceof Promise), 'VALIDATION', 'Comandos locais devem ser síncronos.')
      envelope.data = validateDomainData(envelope.data)
      this.write(this.key, JSON.stringify(envelope))
      this.notify()
      return structuredClone(result)
    })
  }
  async restoreInitialScenario(confirmation: { confirmed: boolean }): Promise<void> {
    invariant(confirmation?.confirmed === true, 'CONFIRMATION_REQUIRED', 'A restauração exige confirmação explícita.')
    await this.exclusive(() => {
      const raw = this.readRaw()
      if (raw !== null) this.write(`${this.key}.recovery`, raw)
      this.write(this.key, JSON.stringify(this.seed()))
      this.notify()
    })
  }
}
