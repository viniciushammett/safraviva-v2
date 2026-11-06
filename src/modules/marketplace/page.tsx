import { Store } from 'lucide-react'
import { ModulePage } from '@/components/shared/module-page'
export function MarketplacePage() { return <ModulePage icon={Store} content={{ title: 'Mercado Agrícola', description: 'Um espaço para aproximar sua empresa de produtores rurais.', section: 'Conexões comerciais', emptyTitle: 'Novas conexões com o campo', emptyDescription: 'Este espaço será dedicado à descoberta de produtos e ofertas agrícolas. A consulta de ofertas ainda não está disponível.', topics: ['Produtos agrícolas', 'Conexões com produtores', 'Oportunidades de compra'] }} /> }
