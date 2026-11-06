import { cn } from '@/lib/utils'
export function StatusBadge({ children, active = false }: { children: React.ReactNode; active?: boolean }) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', active ? 'border-[#cce5d7] bg-[#edf7f0] text-primary' : 'border-border bg-background text-muted-foreground')}><span className={cn('size-1.5 rounded-full', active ? 'bg-accent' : 'bg-muted-foreground')} />{children}</span>
}
