import { availableOrderActions } from '@/domain/order-actions'
import { requireOrganization } from '@/services/domain/command-context'
import { invariant } from '@/domain/errors'
import type { DomainData } from '@/types/domain'
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
  private catalog(data: DomainData) {
    return data.offers.filter((offer) => offer.status === 'published' && availableQuantity(data, offer) > 0 && data.organizations.some((org) => org.id === offer.producerOrganizationId && org.active)).map((offer) => {
      const producer = data.organizations.find((org) => org.id === offer.producerOrganizationId)!
      const production = data.productions.find((row) => row.id === offer.productionId)!
      const product = data.products.find((row) => row.id === production.productId)!
      return { ...offer, availableQuantityKg: availableQuantity(data, offer), productName: product.name, category: product.category, producerName: producer.name, region: `${producer.city}/${producer.state}` }
    })
  }
  async availableOffers() { return this.catalog(await this.database.snapshot()) }
  async marketplace(organizationId: string) {
    const data = await this.database.snapshot()
    requireOrganization(data, organizationId, 'buyer')
    return this.catalog(data)
  }
  async ordersWorkspace(organizationId: string) {
    const data = await this.database.snapshot()
    const organization = data.organizations.find((row) => row.id === organizationId)
    invariant(organization && ['buyer', 'producer'].includes(organization.type), 'FORBIDDEN', 'Selecione uma organização comercial válida.')
    requireOrganization(data, organizationId, organization.type)
    return data.orders.filter((order) => organization.type === 'producer' ? order.producerOrganizationId === organizationId : order.buyerOrganizationId === organizationId).map((order) => {
      const offer = data.offers.find((row) => row.id === order.offerId)!
      const production = data.productions.find((row) => row.id === offer.productionId)!
      const product = data.products.find((row) => row.id === production.productId)!
      const producer = data.organizations.find((row) => row.id === order.producerOrganizationId)!
      const buyer = data.organizations.find((row) => row.id === order.buyerOrganizationId)!
      const history = data.domainEvents.filter((event) => event.aggregateType === 'order' && event.aggregateId === order.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      const cancellationRequested = ['confirmed', 'preparing'].includes(order.status) && history.some((event) => event.eventType === 'order_cancellation_requested')
      const operation = data.logistics.find((row) => row.orderIds.includes(order.id))
      return {
        ...order, delivery: order.delivery, productName: product.name, producerName: producer.name, buyerName: buyer.name,
        origin: `${producer.city}/${producer.state}`, destination: `${buyer.city}/${buyer.state}`,
        availabilityType: offer.availabilityType, availableFrom: offer.availableFrom,
        history, cancellationRequested, actions: availableOrderActions(order, organization.type, cancellationRequested),
        logistics: operation ? { id: operation.id, status: operation.status, transportMode: operation.transportMode, partnerName: data.organizations.find((row) => row.id === operation.partnerOrganizationId)!.name } : null,
      }
    }).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id))
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
