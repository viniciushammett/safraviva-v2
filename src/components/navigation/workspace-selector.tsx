import { useEffect, useState } from 'react'
import { ArrowRight, Building2, MapPin, Sprout, UserRound, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Brand } from '@/components/shared/brand'
import { Button } from '@/components/ui/button'
import { profileLabels } from '@/data/workspaces'
import { workspaceRepository } from '@/repositories/workspace-repository'
import { activateWorkspace } from '@/services/workspace-service'
import { useFeedback } from '@/app/providers/feedback-provider'
import type { Workspace } from '@/types/workspace'

export function WorkspaceSelector() {
  const [workspaces, setWorkspaces] = useState<readonly Workspace[]>([])
  const navigate = useNavigate()
  const notify = useFeedback()
  useEffect(() => { document.title = 'Selecione seu ambiente | SafraViva' }, [])
  useEffect(() => { let active = true; workspaceRepository.list().then((items) => { if (active) setWorkspaces(items) }); return () => { active = false } }, [])
  function select(workspace: Workspace) { navigate(activateWorkspace(workspace.id)); notify(`Ambiente de ${workspace.name} acessado.`) }
  return <div className="flex min-h-dvh flex-col bg-background">
    <header className="border-b border-white/10 bg-[#102f24] px-6 py-5 text-white sm:px-12"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4"><Brand /><span className="hidden text-xs text-white/60 sm:block">Plataforma de Inteligência Comercial Agrícola</span></div></header>
    <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 sm:py-20">
      <div className="mb-10 max-w-2xl"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Bem-vindo à SafraViva</p><h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Selecione seu ambiente<br className="hidden sm:block" /> de trabalho</h1><p className="mt-4 text-sm leading-7 text-muted-foreground">Acesse a organização que deseja gerenciar. Cada ambiente reúne<br className="hidden sm:block" /> as ferramentas e informações do seu perfil de atuação.</p></div>
      <div className="grid gap-5 md:grid-cols-2">{workspaces.map((workspace) => {
        const Icon = workspace.profile === 'producer' ? Sprout : Building2
        return <article key={workspace.id} className="group rounded-xl border bg-white p-6 shadow-soft transition-shadow hover:shadow-md sm:p-7"><div className="mb-7 flex items-start justify-between"><span className="flex size-12 items-center justify-center rounded-xl border border-[#d4e6da] bg-[#edf5ef] text-primary"><Icon size={25} strokeWidth={1.5} /></span><span className="rounded border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{profileLabels[workspace.profile]}</span></div><h2 className="text-xl font-semibold tracking-tight">{workspace.name}</h2><p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={15} />{workspace.location}</p><div className="my-6 flex items-center gap-3 border-t pt-5"><span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-semibold text-primary">{workspace.user.initials}</span><div><p className="text-sm font-medium">{workspace.user.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{workspace.user.role}</p></div><UserRound className="ml-auto text-muted-foreground" size={16} /></div><Button className="w-full justify-between" onClick={() => select(workspace)}>Acessar ambiente <ArrowRight size={16} /></Button></article>
      })}</div>
      <p className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground"><ShieldCheck size={15} />Ambientes demonstrativos · Sem necessidade de autenticação</p>
    </main><footer className="flex flex-wrap justify-between gap-3 border-t px-6 py-5 text-[11px] text-muted-foreground sm:px-12"><span>SafraViva © {new Date().getFullYear()}</span><span>Conexões que fortalecem o agronegócio.</span></footer>
  </div>
}
