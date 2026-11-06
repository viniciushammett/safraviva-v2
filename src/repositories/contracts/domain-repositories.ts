import type { DomainData, DomainEvent, LogisticsOperation, MarketAnalysis, Offer, Order, Organization, Product, Production, User } from '@/types/domain'

// REST adapters can implement the same asynchronous read contracts.
export interface Repository<T extends { id: string }> {
  list(): Promise<readonly T[]>
  findById(id: string): Promise<T | null>
  getById(id: string): Promise<T>
}
export interface OrganizationsRepository extends Repository<Organization> { readonly kind: 'organizations' }
export interface UsersRepository extends Repository<User> { readonly kind: 'users' }
export interface ProductsRepository extends Repository<Product> { readonly kind: 'products' }
export interface ProductionsRepository extends Repository<Production> { readonly kind: 'productions' }
export interface OffersRepository extends Repository<Offer> { readonly kind: 'offers' }
export interface OrdersRepository extends Repository<Order> { readonly kind: 'orders' }
export interface LogisticsRepository extends Repository<LogisticsOperation> { readonly kind: 'logistics' }
export interface MarketAnalysisRepository extends Repository<MarketAnalysis> { readonly kind: 'marketAnalyses' }
export interface DomainEventsRepository extends Repository<DomainEvent> { readonly kind: 'domainEvents' }
export interface DomainRepositories {
  organizations: OrganizationsRepository
  users: UsersRepository
  products: ProductsRepository
  productions: ProductionsRepository
  offers: OffersRepository
  orders: OrdersRepository
  logistics: LogisticsRepository
  marketAnalyses: MarketAnalysisRepository
  domainEvents: DomainEventsRepository
}
export interface StoragePort {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface DomainUnitOfWork {
  snapshot(): Promise<DomainData>
  transaction<T>(command: (draft: DomainData) => T): Promise<T>
}
