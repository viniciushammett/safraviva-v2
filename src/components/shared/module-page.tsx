import type { LucideIcon } from 'lucide-react'
import { Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { EmptyState } from '@/components/feedback/empty-state'

export interface ModulePageContent { title: string; description: string; section: string; emptyTitle: string; emptyDescription: string; topics: readonly string[] }
export function ModulePage({ content, icon }: { content: ModulePageContent; icon: LucideIcon }) {
  return <><PageHeader eyebrow="Área de trabalho" title={content.title} description={content.description} /><section className="overflow-hidden rounded-xl border bg-white shadow-soft"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5"><h2 className="text-sm font-semibold">{content.section}</h2><StatusBadge>Em preparação</StatusBadge></div><EmptyState icon={icon} title={content.emptyTitle} description={content.emptyDescription} /><div className="flex items-start gap-2 border-t bg-background px-6 py-4 text-xs leading-5 text-muted-foreground"><Info className="mt-0.5 shrink-0" size={15} /><p>Esta área está em preparação. As ferramentas operacionais ainda não estão disponíveis.</p></div></section><section className="mt-7"><h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sobre esta área</h2><div className="mt-3 grid gap-3 sm:grid-cols-3">{content.topics.map((topic, index) => <div key={topic} className="flex items-center gap-3 rounded-lg border bg-white p-4"><span className="text-[11px] font-medium text-accent">0{index + 1}</span><span className="text-xs text-muted-foreground">{topic}</span></div>)}</div></section></>
}
