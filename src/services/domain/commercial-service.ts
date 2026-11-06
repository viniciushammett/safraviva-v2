import { z } from 'zod'
import { allocatedProductionQuantity, availableQuantity, commercialVolume, committedQuantity, isCommitted, orderTotal, roundKg } from '@/domain/calculations'
import { invariant } from '@/domain/errors'
import { createOfferSchema, createProductionSchema, offerSchema, productionSchema, requestOrderSchema } from '@/domain/schemas'
import type { DomainUnitOfWork } from '@/repositories/contracts/domain-repositories'
import type { DomainData, EventType, Offer, Order, Production } from '@/types/domain'
import { defaultEnvironment, findRecord, recordEvent, requireOrganization, requireOwner, type CommandEnvironment } from '@/services/domain/command-context'

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  invariant(result.success, 'VALIDATION', result.error?.issues[0]?.message ?? 'Dados inválidos.')
  return result.data
}
export type CreateProductionInput = z.infer<typeof createProductionSchema>
export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type RequestOrderInput = z.infer<typeof requestOrderSchema>
const editOfferSchema = offerSchema.pick({ quantityKg: true, pricePerKg: true, availabilityType: true, availableFrom: true }).partial()
const editProductionSchema = productionSchema.pick({ estimatedQuantityKg: true, harvestedQuantityKg: true, expectedHarvestDate: true, status: true }).partial()

export class CommercialService {
  constructor(private readonly database: DomainUnitOfWork, private readonly env: CommandEnvironment = defaultEnvironment) {}

  async createProduction(actorId: string, input: CreateProductionInput): Promise<Production> {
    const values = parse(createProductionSchema, input)
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      findRecord(data.products, values.productId)
      const now = this.env.now()
      const production: Production = { ...values, id: this.env.id(), producerOrganizationId: actorId, createdAt: now, updatedAt: now }
      data.productions.push(production)
      recordEvent(data, this.env, 'production', production.id, 'production_created', { actorOrganizationId: actorId, toStatus: production.status, ...values }, now)
      return production
    })
  }
  async updateProduction(actorId: string, id: string, input: z.infer<typeof editProductionSchema>) {
    const values = parse(editProductionSchema, input)
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const production = findRecord(data.productions, id)
      requireOwner(production.producerOrganizationId, actorId)
      invariant(production.status !== 'finished', 'INVALID_TRANSITION', 'Produção finalizada não pode ser editada.')
      const next = values.status ?? production.status
      invariant(next === production.status || (production.status === 'growing' && next === 'harvested') || (production.status === 'harvested' && next === 'finished'), 'INVALID_TRANSITION', 'Transição de produção inválida.')
      const previous = { ...production }
      Object.assign(production, values, { updatedAt: this.env.now() })
      invariant(allocatedProductionQuantity(data, id) <= commercialVolume(production), 'INSUFFICIENT_STOCK', 'Volume colhido ou estimado inferior às ofertas vinculadas.')
      recordEvent(data, this.env, 'production', id, 'production_updated', { actorOrganizationId: actorId, fromStatus: previous.status, toStatus: production.status, before: previous, changes: values }, production.updatedAt)
      return production
    })
  }
  async createOffer(actorId: string, input: CreateOfferInput): Promise<Offer> {
    const values = parse(createOfferSchema, input)
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const production = findRecord(data.productions, values.productionId)
      requireOwner(production.producerOrganizationId, actorId)
      invariant(production.status !== 'finished', 'INVALID_TRANSITION', 'Produção finalizada não permite novas ofertas.')
      invariant(roundKg(allocatedProductionQuantity(data, production.id) + values.quantityKg) <= commercialVolume(production), 'INSUFFICIENT_STOCK', 'Oferta superior ao volume comercializável disponível.')
      this.validateAvailability(production, values)
      const now = this.env.now()
      const offer: Offer = { ...values, id: this.env.id(), producerOrganizationId: actorId, status: 'draft', createdAt: now, updatedAt: now }
      data.offers.push(offer)
      recordEvent(data, this.env, 'offer', offer.id, 'offer_created', { actorOrganizationId: actorId, toStatus: 'draft', ...values }, now)
      return offer
    })
  }
  private validateAvailability(production: Production, values: Pick<Offer, 'availabilityType' | 'availableFrom'>) {
    if (values.availabilityType === 'immediate') {
      invariant(production.status !== 'growing', 'VALIDATION', 'Oferta imediata exige produção colhida.')
      invariant(values.availableFrom <= this.env.now().slice(0, 10), 'VALIDATION', 'Oferta imediata não pode ter disponibilidade futura.')
    } else {
      invariant(values.availableFrom > this.env.now().slice(0, 10), 'VALIDATION', 'Colheita futura exige data de disponibilidade futura.')
      invariant(values.availableFrom >= production.expectedHarvestDate, 'VALIDATION', 'Disponibilidade anterior à colheita prevista.')
    }
  }
  async editOffer(actorId: string, id: string, input: z.infer<typeof editOfferSchema>) {
    const values = parse(editOfferSchema, input)
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const offer = findRecord(data.offers, id)
      requireOwner(offer.producerOrganizationId, actorId)
      invariant(offer.status !== 'closed', 'INVALID_TRANSITION', 'Oferta encerrada não pode ser editada.')
      const before = { ...offer }
      Object.assign(offer, values, { updatedAt: this.env.now() })
      invariant(offer.quantityKg >= committedQuantity(data, id), 'INSUFFICIENT_STOCK', 'Quantidade inferior ao volume reservado ou vendido.')
      this.validateAvailability(findRecord(data.productions, offer.productionId), offer)
      recordEvent(data, this.env, 'offer', id, 'offer_updated', { actorOrganizationId: actorId, before, changes: values }, offer.updatedAt)
      return offer
    })
  }
  async publishOffer(actorId: string, id: string) { return this.changeOfferStatus(actorId, id, 'published') }
  async pauseOffer(actorId: string, id: string) { return this.changeOfferStatus(actorId, id, 'paused') }
  async closeOffer(actorId: string, id: string) { return this.changeOfferStatus(actorId, id, 'closed') }
  private async changeOfferStatus(actorId: string, id: string, status: Offer['status']) {
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'producer')
      const offer = findRecord(data.offers, id)
      requireOwner(offer.producerOrganizationId, actorId)
      const transitions: Record<Offer['status'], Offer['status'][]> = { draft: ['published', 'closed'], published: ['paused', 'closed'], paused: ['published', 'closed'], closed: [] }
      invariant(transitions[offer.status].includes(status), 'INVALID_TRANSITION', 'Transição de oferta inválida.')
      if (status === 'published') {
        const production = findRecord(data.productions, offer.productionId)
        invariant(production.status !== 'finished', 'INVALID_TRANSITION', 'Produção finalizada não permite publicar ofertas.')
        invariant(availableQuantity(data, offer) > 0, 'INSUFFICIENT_STOCK', 'Oferta totalmente comprometida.')
        this.validateAvailability(production, offer)
      }
      const fromStatus = offer.status
      offer.status = status
      offer.updatedAt = this.env.now()
      const events: Partial<Record<Offer['status'], EventType>> = { published: 'offer_published', paused: 'offer_paused', closed: 'offer_closed' }
      recordEvent(data, this.env, 'offer', id, events[status]!, { actorOrganizationId: actorId, fromStatus, toStatus: status }, offer.updatedAt)
      return offer
    })
  }
  async requestOrder(actorId: string, input: RequestOrderInput): Promise<Order> {
    const values = parse(requestOrderSchema, input)
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'buyer')
      // Stable canonical command: key reuse with a different payload is a conflict.
      const key = JSON.stringify([actorId, values.idempotencyKey])
      const fingerprint = JSON.stringify([actorId, values.offerId, values.quantityKg])
      const receipt = data.commandReceipts.find((row) => row.id === key)
      if (receipt) {
        invariant(receipt.fingerprint === fingerprint, 'CONFLICT', 'Chave idempotente já utilizada em outra solicitação.')
        return findRecord(data.orders, receipt.resultId)
      }
      const offer = findRecord(data.offers, values.offerId)
      requireOrganization(data, offer.producerOrganizationId, 'producer')
      invariant(offer.status === 'published', 'INVALID_TRANSITION', 'Apenas ofertas publicadas aceitam solicitações.')
      invariant(values.quantityKg <= availableQuantity(data, offer), 'INSUFFICIENT_STOCK', 'Quantidade superior ao saldo disponível.')
      const now = this.env.now()
      const order: Order = { id: this.env.id(), offerId: offer.id, producerOrganizationId: offer.producerOrganizationId, buyerOrganizationId: actorId, quantityKg: values.quantityKg, unitPrice: offer.pricePerKg, totalAmount: orderTotal(values.quantityKg, offer.pricePerKg), status: 'pending_confirmation', requestedAt: now, updatedAt: now }
      data.orders.push(order)
      data.commandReceipts.push({ id: key, fingerprint, resultId: order.id, collection: 'orders' })
      recordEvent(data, this.env, 'order', order.id, 'order_requested', { actorOrganizationId: actorId, fromStatus: null, toStatus: order.status, offerId: offer.id, quantityKg: order.quantityKg, unitPrice: order.unitPrice, totalAmount: order.totalAmount, idempotencyKey: values.idempotencyKey }, now)
      return order
    })
  }
  private producerOrder(data: DomainData, actorId: string, id: string) {
    requireOrganization(data, actorId, 'producer')
    const order = findRecord(data.orders, id)
    requireOwner(order.producerOrganizationId, actorId)
    requireOrganization(data, order.buyerOrganizationId, 'buyer')
    return order
  }
  private transitionOrder(data: DomainData, order: Order, actorId: string, status: Order['status'], eventType: EventType) {
    const fromStatus = order.status
    order.status = status
    order.updatedAt = this.env.now()
    recordEvent(data, this.env, 'order', order.id, eventType, { actorOrganizationId: actorId, fromStatus, toStatus: status, quantityKg: order.quantityKg, unitPrice: order.unitPrice, totalAmount: order.totalAmount }, order.updatedAt)
    return order
  }
  async confirmOrder(actorId: string, id: string) {
    return this.database.transaction((data) => {
      const order = this.producerOrder(data, actorId, id)
      invariant(order.status === 'pending_confirmation', 'INVALID_TRANSITION', 'Somente pedidos pendentes podem ser confirmados.')
      const offer = findRecord(data.offers, order.offerId)
      invariant(offer.status === 'published', 'INVALID_TRANSITION', 'A oferta precisa estar publicada para confirmação.')
      invariant(order.quantityKg <= availableQuantity(data, offer), 'INSUFFICIENT_STOCK', 'Saldo insuficiente para confirmação.')
      return this.transitionOrder(data, order, actorId, 'confirmed', 'order_confirmed')
    })
  }
  async rejectOrder(actorId: string, id: string) {
    return this.database.transaction((data) => {
      const order = this.producerOrder(data, actorId, id)
      invariant(order.status === 'pending_confirmation', 'INVALID_TRANSITION', 'Somente pedidos pendentes podem ser recusados.')
      return this.transitionOrder(data, order, actorId, 'rejected', 'order_rejected')
    })
  }
  async prepareOrder(actorId: string, id: string) {
    return this.database.transaction((data) => {
      const order = this.producerOrder(data, actorId, id)
      invariant(order.status === 'confirmed', 'INVALID_TRANSITION', 'Somente pedidos confirmados podem entrar em preparação.')
      const offer = findRecord(data.offers, order.offerId)
      const production = findRecord(data.productions, offer.productionId)
      invariant(production.status !== 'growing' && offer.availableFrom <= this.env.now().slice(0, 10), 'INVALID_TRANSITION', 'A produção ainda não está disponível para preparação.')
      return this.transitionOrder(data, order, actorId, 'preparing', 'order_preparing')
    })
  }
  async requestCancellation(actorId: string, id: string) {
    return this.database.transaction((data) => {
      requireOrganization(data, actorId, 'buyer')
      const order = findRecord(data.orders, id)
      requireOwner(order.buyerOrganizationId, actorId)
      invariant(['pending_confirmation', 'confirmed', 'preparing'].includes(order.status), 'INVALID_TRANSITION', 'Não é possível cancelar este pedido após início do transporte ou encerramento.')
      if (order.status === 'pending_confirmation') return this.transitionOrder(data, order, actorId, 'cancelled', 'order_cancelled')
      if (!data.domainEvents.some((event) => event.aggregateType === 'order' && event.aggregateId === id && event.eventType === 'order_cancellation_requested')) {
        order.updatedAt = this.env.now()
        recordEvent(data, this.env, 'order', id, 'order_cancellation_requested', { actorOrganizationId: actorId, fromStatus: order.status, toStatus: order.status, approvalRequired: true }, order.updatedAt)
      }
      return order // Reservation is retained until the producer explicitly approves.
    })
  }
  async approveCancellation(actorId: string, id: string) {
    return this.database.transaction((data) => {
      const order = this.producerOrder(data, actorId, id)
      invariant(['confirmed', 'preparing'].includes(order.status), 'INVALID_TRANSITION', 'Cancelamento não permitido neste estado.')
      invariant(data.domainEvents.some((event) => event.aggregateType === 'order' && event.aggregateId === id && event.eventType === 'order_cancellation_requested'), 'INVALID_TRANSITION', 'Não há solicitação de cancelamento para aprovar.')
      this.transitionOrder(data, order, actorId, 'cancelled', 'order_cancelled')
      for (const operation of data.logistics.filter((row) => row.orderIds.includes(id))) {
        invariant(['awaiting_organization', 'transport_requested'].includes(operation.status), 'INVALID_TRANSITION', 'Transporte já iniciado.')
        operation.totalLoadKg = roundKg(data.orders.filter((row) => operation.orderIds.includes(row.id) && isCommitted(row)).reduce((sum, row) => sum + row.quantityKg, 0))
        operation.updatedAt = this.env.now()
      }
      return order
    })
  }
}
