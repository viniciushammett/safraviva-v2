import { ChartNoAxesCombined } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return <div className={cn('flex items-center gap-3', className)}>
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10"><ChartNoAxesCombined size={23} strokeWidth={1.8} /></span>
    {!compact && <div><span className="text-xl font-semibold tracking-tight">Safra<span className="font-normal">Viva</span></span><span className="mt-0.5 block text-[9px] font-medium uppercase tracking-[0.2em] opacity-60">Inteligência comercial agrícola</span></div>}
  </div>
}
