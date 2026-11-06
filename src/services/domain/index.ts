import { browserDomainStorage, LocalDomainDatabase } from '@/repositories/local/domain-database'
import { createLocalDomainRepositories } from '@/repositories/local/domain-repositories'
import { CommercialService } from '@/services/domain/commercial-service'
import { LogisticsService } from '@/services/domain/logistics-service'
import { DomainQueryService } from '@/services/domain/query-service'

export const domainDatabase = new LocalDomainDatabase(browserDomainStorage)
export const domainRepositories = createLocalDomainRepositories(domainDatabase)
export const commercialService = new CommercialService(domainDatabase)
export const logisticsService = new LogisticsService(domainDatabase)
export const domainQueryService = new DomainQueryService(domainDatabase)
export const restoreInitialScenario = (confirmation: { confirmed: boolean }) => domainDatabase.restoreInitialScenario(confirmation)

export { MarketIntelligenceService } from '@/services/domain/market-intelligence-service'
