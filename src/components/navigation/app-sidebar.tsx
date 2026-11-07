import { PanelLeftClose, PanelLeftOpen, ArrowUpRight } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'
import { Brand } from '@/components/shared/brand'
import { navigation } from '@/data/navigation'
import { profileLabels } from '@/data/workspaces'
import { cn } from '@/lib/utils'
import { useActiveWorkspace, useWorkspaceStore } from '@/stores/workspace-store'

export function AppSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const workspace = useActiveWorkspace()
  const collapsed = useWorkspaceStore((state) => state.preferences.sidebarCollapsed) && !mobile
  const toggle = useWorkspaceStore((state) => state.toggleSidebar)
  if (!workspace) return null
  return <aside aria-label="Navegação principal" className={cn('flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-[#123326] text-white transition-[width]', collapsed ? 'w-20' : 'w-[260px]', mobile && 'w-full')}>
    <div className={cn('flex h-[84px] shrink-0 items-center border-b border-white/10', collapsed ? 'justify-center' : 'px-6')}><Brand compact={collapsed} /></div>
    <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-3 py-5', collapsed ? 'px-3' : 'px-4')}>
      {!collapsed && <p className="mb-4 px-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">Ambiente {workspace.profile === 'producer' ? 'do produtor' : 'do comprador'}</p>}
      <nav className="space-y-1.5">{navigation[workspace.profile].map(({ path, label, icon: Icon }) => <NavLink key={path} to={path} onClick={onNavigate} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined} className={({ isActive }) => cn('relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors', collapsed && 'justify-center px-0', isActive ? 'bg-white/10 text-white before:absolute before:left-0 before:h-5 before:w-[3px] before:rounded-r before:bg-[#62c48a]' : 'text-white/60 hover:bg-white/5 hover:text-white')}><Icon size={19} strokeWidth={1.6} className="shrink-0" />{!collapsed && label}</NavLink>)}</nav>
    </div>
    <div className="shrink-0 space-y-4 border-t border-white/10 p-4">{!collapsed && <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-[11px] font-medium text-white/85">{profileLabels[workspace.profile]}</p><p className="mt-1 text-[10px] text-white/60">{workspace.location}</p><Link to="/" onClick={onNavigate} className="mt-3 flex items-center justify-between text-[11px] text-white/65 hover:text-white">Alterar ambiente <ArrowUpRight size={13} /></Link></div>}{!mobile && <button onClick={toggle} className={cn('flex w-full items-center gap-3 rounded-md p-2 text-xs text-white/65 hover:bg-white/5 hover:text-white', collapsed && 'justify-center')} aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'}>{collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /><span>Recolher menu</span></>}</button>}</div>
  </aside>
}
