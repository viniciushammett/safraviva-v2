import type { Collection, DomainData } from '@/types/domain'
import type { DomainRepositories, DomainUnitOfWork, Repository } from '@/repositories/contracts/domain-repositories'
import { DomainError } from '@/domain/errors'

function repository<K extends Collection>(database: DomainUnitOfWork, kind: K): Repository<DomainData[K][number]> & { kind: K } {
  return {
    kind,
    async list() { return (await database.snapshot())[kind] },
    async findById(id) { return (await database.snapshot())[kind].find((row) => row.id === id) ?? null },
    async getById(id) {
      const record = await this.findById(id)
      if (!record) throw new DomainError('NOT_FOUND', `Registro não encontrado em ${kind}: ${id}.`)
      return record
    },
  }
}
export function createLocalDomainRepositories(database: DomainUnitOfWork): DomainRepositories {
  return {
    organizations: repository(database, 'organizations'),
    users: repository(database, 'users'),
    products: repository(database, 'products'),
    productions: repository(database, 'productions'),
    offers: repository(database, 'offers'),
    orders: repository(database, 'orders'),
    logistics: repository(database, 'logistics'),
    marketAnalyses: repository(database, 'marketAnalyses'),
    domainEvents: repository(database, 'domainEvents'),
  }
}
