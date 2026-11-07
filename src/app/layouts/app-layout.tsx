import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AppHeader } from '@/components/navigation/app-header'
import { AppSidebar } from '@/components/navigation/app-sidebar'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { navigation } from '@/data/navigation'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const workspace = useActiveWorkspace()
  const { pathname } = useLocation()
  const current = workspace && navigation[workspace.profile].find((item) => item.path === pathname)
  useEffect(() => {
    document.title = `${current?.label ?? 'SafraViva'} | SafraViva`
    document.getElementById('main-content')?.focus({ preventScroll: true })
    document.getElementById('main-content')?.scrollTo?.(0, 0)
  }, [pathname, current?.label])
  // Contain absolute sr-only table captions in main; otherwise their static positions enlarge body.
  return <div className="flex h-dvh overflow-hidden"><div className="hidden min-h-0 shrink-0 overflow-hidden lg:block"><AppSidebar /></div><Dialog open={menuOpen} onOpenChange={setMenuOpen}><DialogContent className="left-0 top-0 h-dvh w-[min(300px,calc(100%-2rem))] max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-[#123326] p-0 text-white [&>button]:text-white"><DialogTitle className="sr-only">Navegação principal</DialogTitle><DialogDescription className="sr-only">Navegue pelas páginas do ambiente ativo.</DialogDescription><AppSidebar mobile onNavigate={() => setMenuOpen(false)} /></DialogContent></Dialog><div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"><AppHeader onOpenMenu={() => setMenuOpen(true)} /><main id="main-content" tabIndex={-1} className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-y-contain"><div className="w-full shrink-0 px-5 py-6 sm:px-8 lg:px-10"><div className="mb-7 flex items-center gap-2 text-[11px] text-muted-foreground"><span>Área de trabalho</span><span aria-hidden="true">/</span><span className="text-foreground">{current?.label ?? 'Página não encontrada'}</span></div><Outlet /></div><footer className="mx-5 mt-auto flex shrink-0 flex-wrap justify-between gap-2 border-t py-4 text-[10px] text-muted-foreground sm:mx-8 lg:mx-10"><span>SafraViva · Inteligência Comercial Agrícola</span><span>Ambiente demonstrativo</span></footer></main></div></div>
}
