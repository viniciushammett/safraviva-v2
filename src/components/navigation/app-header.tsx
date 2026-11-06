import { Menu } from 'lucide-react'
import { WorkspaceSwitcher } from '@/components/navigation/workspace-switcher'
import { SettingsDialog } from '@/components/navigation/settings-dialog'
import { useActiveWorkspace } from '@/stores/workspace-store'

export function AppHeader({ onOpenMenu }: { onOpenMenu: () => void }) {
  const workspace = useActiveWorkspace()
  return <header className="flex h-[84px] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#102f24] px-3 text-white sm:px-7"><div className="flex min-w-0 items-center gap-2"><button onClick={onOpenMenu} className="rounded-md p-2 hover:bg-white/10 lg:hidden" aria-label="Abrir navegação"><Menu size={22} /></button><WorkspaceSwitcher /></div><div className="flex shrink-0 items-center gap-2 sm:gap-5"><SettingsDialog /><div className="hidden h-7 w-px bg-white/15 sm:block" /><div className="flex items-center gap-3"><div className="hidden text-right md:block"><p className="text-xs font-medium">{workspace?.user.name}</p><p className="mt-1 text-[10px] text-white/65">{workspace?.user.role}</p></div><span className="flex size-9 items-center justify-center rounded-full border border-white/20 bg-[#31513f] text-xs font-medium" aria-label={workspace?.user.name}>{workspace?.user.initials}</span></div></div></header>
}
