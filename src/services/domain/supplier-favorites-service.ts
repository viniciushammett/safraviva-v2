import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'
import type { SupplierFavoritesRepository } from '@/repositories/supplier-favorites-repository'
import { invariant } from '@/domain/errors'
import { requireOrganization } from './command-context'
export class SupplierFavoritesService {
  constructor(private readonly database: Pick<DomainUnitOfWork, 'snapshot'>, private readonly repository: SupplierFavoritesRepository) {}
  async list(buyerId: string) { requireOrganization(await this.database.snapshot(), buyerId, 'buyer'); return this.repository.list(buyerId) }
  async set(buyerId: string, supplierId: string, favorite: boolean) {
    const data = await this.database.snapshot()
    requireOrganization(data, buyerId, 'buyer')
    invariant(data.organizations.some((o) => o.id === supplierId && o.type === 'producer'), 'NOT_FOUND', 'Fornecedor não encontrado.')
    return this.repository.set(buyerId, supplierId, favorite)
  }
}
