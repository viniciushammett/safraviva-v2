import { LayoutDashboard, ChartNoAxesCombined, Sprout, ClipboardList, Truck, Store, UsersRound, type LucideIcon } from 'lucide-react'
import type { Profile } from '@/types/workspace'
export interface NavigationItem { path: string; label: string; icon: LucideIcon; description: string }
export const navigation: Record<Profile, NavigationItem[]> = {
  producer: [
    { path: '/producer/overview', label: 'Visão Geral', icon: LayoutDashboard, description: 'Seu ambiente de trabalho em um só lugar.' },
    { path: '/producer/intelligence', label: 'Inteligência de Mercado', icon: ChartNoAxesCombined, description: 'Informações para apoiar suas decisões de comercialização.' },
    { path: '/producer/production', label: 'Produção e Ofertas', icon: Sprout, description: 'Um espaço dedicado à sua produção e às suas ofertas agrícolas.' },
    { path: '/producer/orders', label: 'Pedidos e Vendas', icon: ClipboardList, description: 'Organize o acompanhamento das suas relações comerciais.' },
    { path: '/producer/logistics', label: 'Logística', icon: Truck, description: 'Um espaço para conectar sua produção aos próximos destinos.' },
  ],
  buyer: [
    { path: '/buyer/overview', label: 'Visão Geral', icon: LayoutDashboard, description: 'Seu ambiente de trabalho em um só lugar.' },
    { path: '/buyer/marketplace', label: 'Mercado Agrícola', icon: Store, description: 'Um espaço para aproximar sua empresa de produtores rurais.' },
    { path: '/buyer/orders', label: 'Pedidos e Compras', icon: ClipboardList, description: 'Organize o acompanhamento das suas relações comerciais.' },
    { path: '/buyer/suppliers', label: 'Fornecedores', icon: UsersRound, description: 'Um espaço dedicado à sua rede de parceiros de fornecimento.' },
  ],
}
