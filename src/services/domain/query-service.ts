import { availableQuantity, commercialTotals } from '@/domain/calculations'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'

export class DomainQueryService {
  constructor(private readonly database: DomainUnitOfWork) {}
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
