import { WorkspaceGuard, ProfileIndex } from '@/app/router/workspace-guard'
import { NotFound } from '@/components/feedback/not-found'
import { AppLayout } from '@/app/layouts/app-layout'
import { WorkspaceSelector } from '@/components/navigation/workspace-selector'
import { OverviewPage } from '@/modules/dashboards/overview-page'
import { IntelligencePage } from '@/modules/intelligence/page'
import { ProductionPage } from '@/modules/production/page'
import { MarketplacePage } from '@/modules/marketplace/page'
import { OrdersPage } from '@/modules/orders/page'
import { LogisticsPage } from '@/modules/logistics/page'
import { SuppliersPage } from '@/modules/suppliers/page'

export const routes = [
  { path: '/', element: <WorkspaceSelector /> },
  { element: <WorkspaceGuard />, children: [{ element: <AppLayout />, children: [
    { path: 'producer', element: <WorkspaceGuard profile="producer" />, children: [
      { index: true, element: <ProfileIndex /> },
      { path: 'overview', element: <OverviewPage /> }, { path: 'intelligence', element: <IntelligencePage /> },
      { path: 'production', element: <ProductionPage /> }, { path: 'orders', element: <OrdersPage /> }, { path: 'logistics', element: <LogisticsPage /> },
      { path: '*', element: <ProfileIndex /> },
    ] },
    { path: 'buyer', element: <WorkspaceGuard profile="buyer" />, children: [
      { index: true, element: <ProfileIndex /> },
      { path: 'overview', element: <OverviewPage /> }, { path: 'marketplace', element: <MarketplacePage /> },
      { path: 'orders', element: <OrdersPage /> }, { path: 'suppliers', element: <SuppliersPage /> },
      { path: '*', element: <ProfileIndex /> },
    ] },
  ] }] },
  { path: '*', element: <NotFound /> },
]
