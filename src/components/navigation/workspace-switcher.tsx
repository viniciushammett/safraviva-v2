import { Check, ChevronsUpDown, Building2, ArrowUpRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useFeedback } from '@/app/providers/feedback-provider'
import { profileLabels, workspaces } from '@/data/workspaces'
import { activateWorkspace } from '@/services/workspace-service'
import { useActiveWorkspace } from '@/stores/workspace-store'

export function WorkspaceSwitcher() {
  const active = useActiveWorkspace()
  const navigate = useNavigate()
  const notify = useFeedback()
  if (!active) return null
  return <DropdownMenu><DropdownMenuTrigger className="flex min-w-0 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10" aria-label={`Alternar ambiente. Atual: ${active.name}`}><span className="hidden size-9 items-center justify-center rounded-md border border-white/15 bg-white/5 text-xs font-semibold sm:flex">{active.initials}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{active.name}</span><span className="mt-0.5 block text-[11px] text-white/65">{profileLabels[active.profile]}</span></span><ChevronsUpDown size={15} className="ml-1 shrink-0 text-white/65" /></DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-80"><DropdownMenuLabel className="block px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ambientes de trabalho</DropdownMenuLabel>{workspaces.map((workspace) => <DropdownMenuItem key={workspace.id} onSelect={() => { if (workspace.id !== active.id) { navigate(activateWorkspace(workspace.id)); notify(`Ambiente alterado para ${workspace.name}.`) } }}><Building2 size={18} className="shrink-0 text-primary" /><span><span className="block font-medium">{workspace.name}</span><span className="text-xs text-muted-foreground">{profileLabels[workspace.profile]}</span></span>{active.id === workspace.id && <Check size={16} className="ml-auto text-accent" aria-label="Ambiente ativo" />}</DropdownMenuItem>)}<DropdownMenuSeparator /><DropdownMenuItem asChild><Link to="/"><ArrowUpRight size={16} />Ver todos os ambientes</Link></DropdownMenuItem></DropdownMenuContent>
  </DropdownMenu>
}
