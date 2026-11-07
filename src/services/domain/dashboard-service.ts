import { availableCatalog, availableProductionKg, commercialIndicators, DASHBOARD_CONFIG, deliveredSeries, operationalAlerts, scopedOrders, type DashboardPeriod } from '@/domain/operational-analytics'
import { consolidationOpportunities } from '@/domain/logistics-planning'
import { invariant } from '@/domain/errors'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'
import { defaultEnvironment, requireOrganization, type CommandEnvironment } from './command-context'
import { MarketIntelligenceService } from './market-intelligence-service'
export class DashboardService {
  constructor(private readonly database: Pick<DomainUnitOfWork, 'snapshot'>, private readonly clock: Pick<CommandEnvironment, 'now'> = defaultEnvironment) {}
  async overview(organizationId: string, period: DashboardPeriod) {
    const data = await this.database.snapshot()
    const organization = data.organizations.find((o) => o.id === organizationId)
    invariant(organization && (organization.type === 'producer' || organization.type === 'buyer'), 'FORBIDDEN', 'Selecione uma organização comercial válida.')
    requireOrganization(data, organizationId, organization.type)
    const now = this.clock.now()
    const orders = scopedOrders(data, organizationId, organization.type)
    const catalog = availableCatalog(data)
    const indicators = { ...commercialIndicators(orders), availableProductionKg: organization.type === 'producer' ? availableProductionKg(data, organizationId) : null, activeSuppliers: organization.type === 'buyer' ? new Set(catalog.map((o) => o.producerOrganizationId)).size : null }
    const recentOrders = [...orders].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt) || a.id.localeCompare(b.id)).slice(0, DASHBOARD_CONFIG.recentOrdersLimit).map((order) => {
      const offer = data.offers.find((o) => o.id === order.offerId)!
      const product = data.products.find((p) => p.id === data.productions.find((p) => p.id === offer.productionId)!.productId)!
      return { ...order, productName: product.name, counterpartyName: data.organizations.find((o) => o.id === (organization.type === 'producer' ? order.buyerOrganizationId : order.producerOrganizationId))!.name }
    })
    // The market engine reads the same snapshot, preventing a mixed-revision dashboard.
    const intelligence = new MarketIntelligenceService({ snapshot: async () => data })
    const productIds = new Set(data.productions.filter((p) => p.producerOrganizationId === organizationId).map((p) => p.productId))
    const combinations = [...new Map(data.marketAnalyses.filter((a) => a.periodDays === 30 && productIds.has(a.productId)).map((a) => [`${a.productId}|${a.region}`, { productId: a.productId, region: a.region, periodDays: 30 }])).values()].sort((a, b) => a.productId.localeCompare(b.productId) || a.region.localeCompare(b.region))
    const analyses = organization.type === 'producer' ? await Promise.all(combinations.map((input) => intelligence.query(input))) : []
    const recommendations = analyses.filter((r) => r.status === 'available').sort((a, b) => Number(b.guidance.condition === 'opportunity') - Number(a.guidance.condition === 'opportunity')).slice(0, DASHBOARD_CONFIG.opportunityLimit)
    const supplyOpportunities = organization.type === 'buyer' ? [...catalog].sort((a, b) => {
      const orgA = data.organizations.find((o) => o.id === a.producerOrganizationId)!, orgB = data.organizations.find((o) => o.id === b.producerOrganizationId)!
      const rank = (org: typeof orgA) => org.city === organization.city && org.state === organization.state ? 0 : org.state === organization.state ? 1 : 2
      return rank(orgA) - rank(orgB) || a.availableFrom.localeCompare(b.availableFrom) || a.id.localeCompare(b.id)
    }).slice(0, DASHBOARD_CONFIG.opportunityLimit) : []
    return { profile: organization.type, referenceDate: now, period, indicators, series: deliveredSeries(data, orders, period, now), recentOrders, recommendations, supplyOpportunities, alerts: organization.type === 'producer' ? { ...operationalAlerts(data, organizationId, now), logisticsOpportunities: consolidationOpportunities(data, organizationId, now.slice(0, 10)).length } : null }
  }
}
