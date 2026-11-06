import type { Offer, Production } from '@/types/domain'
import type { DomainQueryService } from '@/services/domain/query-service'
export type ProducerWorkspace = Awaited<ReturnType<DomainQueryService['producerWorkspace']>>
export const productionStatuses: Record<Production['status'], string> = { growing: 'Em cultivo', harvested: 'Colhida', finished: 'Finalizada' }
export const offerStatuses: Record<Offer['status'], string> = { draft: 'Rascunho', published: 'Publicada', paused: 'Pausada', closed: 'Encerrada' }
export const quantity = (n: number) => `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(n)} kg`
export const currency = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
export const dateLabel = (date: string) => date.slice(0, 10).split('-').reverse().join('/')
export const fieldClass = 'mt-2 h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:bg-muted'
export const cellClass = 'whitespace-nowrap px-4 py-4 text-left text-xs'
