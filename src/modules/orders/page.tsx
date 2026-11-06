import { ClipboardList } from 'lucide-react'
import { ModulePage } from '@/components/shared/module-page'
import { useActiveWorkspace } from '@/stores/workspace-store'
export function OrdersPage() {
  const isProducer = useActiveWorkspace()?.profile === 'producer'
  return <ModulePage icon={ClipboardList} content={{ title: isProducer ? 'Pedidos e Vendas' : 'Pedidos e Compras', description: 'Organize o acompanhamento das suas relações comerciais.', section: isProducer ? 'Acompanhamento de vendas' : 'Acompanhamento de compras', emptyTitle: 'Relações comerciais bem organizadas', emptyDescription: `Este espaço será dedicado ao acompanhamento de ${isProducer ? 'vendas' : 'compras'} da sua organização. A operação de pedidos ainda não está disponível.`, topics: ['Relações comerciais', 'Organização de pedidos', isProducer ? 'Acompanhamento de vendas' : 'Acompanhamento de compras'] }} />
}
