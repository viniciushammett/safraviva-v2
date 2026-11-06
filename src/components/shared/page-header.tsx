import type { ReactNode } from 'react'
export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div className="max-w-2xl"><p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>{action}</div>
}
