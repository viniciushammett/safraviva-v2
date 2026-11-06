import type { LucideIcon } from 'lucide-react'
export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center"><div className="mb-5 rounded-xl border bg-background p-4 text-primary"><Icon size={26} strokeWidth={1.5} /></div><h3 className="text-base font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p></div>
}
