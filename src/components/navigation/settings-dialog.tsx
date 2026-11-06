import { Settings2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useActiveWorkspace, useWorkspaceStore } from '@/stores/workspace-store'
import { Button } from '@/components/ui/button'

export function SettingsDialog() {
  const workspace = useActiveWorkspace()
  const collapsed = useWorkspaceStore((state) => state.preferences.sidebarCollapsed)
  const toggleSidebar = useWorkspaceStore((state) => state.toggleSidebar)
  return <Dialog><DialogTrigger asChild><button className="rounded-md p-2.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label="Abrir configurações"><Settings2 size={19} /></button></DialogTrigger><DialogContent><DialogTitle className="text-xl font-semibold">Configurações do ambiente</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">Preferências da interface neste navegador. Este é um ambiente demonstrativo.</DialogDescription><div className="mt-6 rounded-lg border bg-background p-4"><p className="text-sm font-medium">{workspace?.name}</p><p className="mt-1 text-xs text-muted-foreground">{workspace?.user.name} · {workspace?.user.role}</p></div><div className="mt-5 flex items-center justify-between gap-4"><div><p className="text-sm font-medium">Navegação compacta</p><p className="mt-1 text-xs text-muted-foreground">Recolher a sidebar no desktop.</p></div><Button variant="outline" size="sm" onClick={toggleSidebar} aria-pressed={collapsed}>{collapsed ? 'Ativada' : 'Desativada'}</Button></div></DialogContent></Dialog>
}
