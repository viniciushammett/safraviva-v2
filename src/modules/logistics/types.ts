import type { LogisticsService } from '@/services/domain/logistics-service'
export type LogisticsWorkspace = Awaited<ReturnType<LogisticsService['planningWorkspace']>>
export type DeliveryRow = LogisticsWorkspace['reviewable'][number]
export type Opportunity = LogisticsWorkspace['opportunities'][number]
