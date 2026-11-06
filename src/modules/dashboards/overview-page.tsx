import { ArrowRight, ArrowUpRight, MapPin, Building2, Check, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { navigation } from '@/data/navigation'
import { profileLabels } from '@/data/workspaces'
import { useActiveWorkspace } from '@/stores/workspace-store'

export function OverviewPage() {
  const workspace = useActiveWorkspace()
  if (!workspace) return null
  const isProducer = workspace.profile === 'producer'
  return <>
    <PageHeader eyebrow="Visão geral" title={`Olá, ${workspace.user.name.split(' ')[0]}.`} description="Bem-vindo ao seu espaço de inteligência comercial agrícola." action={<StatusBadge active>Ambiente ativo</StatusBadge>} />
    <section className="relative mb-8 overflow-hidden rounded-xl border border-[#cddfd3] bg-[#edf4ee] p-6 sm:p-8" aria-labelledby="workspace-heading"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/70">Seu ambiente de trabalho</p><h2 id="workspace-heading" className="text-xl font-semibold tracking-tight text-primary sm:text-2xl">{workspace.name}</h2><p className="mt-3 max-w-xl text-sm leading-6 text-[#52685a]">{isProducer ? 'Da produção às conexões comerciais. Organize sua jornada e explore os espaços dedicados ao seu negócio.' : 'Conecte sua operação ao mercado agrícola. Explore os espaços dedicados às suas compras e relações de fornecimento.'}</p><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#52685a]"><span className="flex items-center gap-1.5"><Building2 size={14} />{profileLabels[workspace.profile]}</span><span className="flex items-center gap-1.5"><MapPin size={14} />{workspace.location}</span></div></div><span className="hidden size-16 items-center justify-center rounded-xl border border-primary/15 bg-white/60 text-xl font-medium text-primary sm:flex">{workspace.initials}</span></div></section>
    <div className="mb-5 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-base font-semibold">Explore seu ambiente</h2><p className="mt-1 text-xs text-muted-foreground">Acesse as áreas de atuação da sua organização.</p></div><span className="text-[11px] text-muted-foreground">{profileLabels[workspace.profile]}</span></div>
    <div className="grid gap-4 md:grid-cols-2">{navigation[workspace.profile].slice(1).map(({ path, label, icon: Icon, description }) => <Link to={path} key={path} className="group rounded-lg border bg-white p-5 shadow-soft transition-colors hover:border-[#a3c9b1] hover:bg-[#fcfefc]"><div className="mb-4 flex items-center justify-between"><span className="rounded-lg border bg-background p-2.5 text-primary"><Icon size={21} strokeWidth={1.5} /></span><ArrowUpRight size={17} className="text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></div><h3 className="text-sm font-semibold">{label}</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p><span className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary">Acessar área <ArrowRight size={14} /></span></Link>)}</div>
    <section className="mt-7 flex flex-col gap-6 rounded-lg border bg-white p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><Compass className="mt-0.5 shrink-0 text-accent" size={20} /><div><h2 className="text-sm font-medium">Um espaço para cada etapa do seu negócio</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">As áreas estão organizadas. Novas ferramentas serão disponibilizadas nas próximas atualizações.</p></div></div><span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] text-primary"><Check size={14} />Organização selecionada</span></section>
  </>
}
