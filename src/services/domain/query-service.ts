import { allocatedProductionQuantity, availableQuantity, commercialTotals, commercialVolume, committedQuantity } from '@/domain/calculations'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'

export class DomainQueryService {
  constructor(private readonly database: DomainUnitOfWork) {}
  async producerWorkspace(organizationId: string) {
    const data = await this.database.snapshot()
    const productions = data.productions.filter((row) => row.producerOrganizationId === organizationId)
    return {
      products: data.products,
      productions: productions.map((production) => ({
        ...production,
        productName: data.products.find((p) => p.id === production.productId)?.name ?? production.productId,
        allocatedQuantityKg: allocatedProductionQuantity(data, production.id),
        commercialVolumeKg: commercialVolume(production),
      })),
      offers: data.offers.filter((row) => row.producerOrganizationId === organizationId).map((offer) => ({
        ...offer,
        productName: data.products.find((p) => p.id === productions.find((row) => row.id === offer.productionId)?.productId)?.name ?? 'Produto indisponível',
        committedQuantityKg: committedQuantity(data, offer.id),
        availableQuantityKg: availableQuantity(data, offer),
      })),
    }
  }
  async snapshot() { return this.database.snapshot() }
  async availableOffers() {
    const data = await this.database.snapshot()
    return data.offers.filter((offer) => offer.status === 'published' && availableQuantity(data, offer) > 0 && data.organizations.some((org) => org.id === offer.producerOrganizationId && org.active)).map((offer) => ({ ...offer, availableQuantityKg: availableQuantity(data, offer) }))
  }
  async organizationTotals(organizationId: string) {
    const data = await this.database.snapshot()
    return commercialTotals(data.orders.filter((order) => order.producerOrganizationId === organizationId || order.buyerOrganizationId === organizationId))
  }
  async orderHistory(orderId: string) {
    const data = await this.database.snapshot()
    return data.domainEvents.filter((event) => event.aggregateType === 'order' && event.aggregateId === orderId).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }
}
