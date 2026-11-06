import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
export function EditorPanel({ title, description, children, onClose, busy = false }: { title: string; description: string; children: ReactNode; onClose: () => void; busy?: boolean }) {
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}><DialogContent className="left-auto right-0 top-0 h-dvh max-h-dvh max-w-xl translate-x-0 translate-y-0 overflow-y-auto rounded-none p-6 sm:p-8"><DialogTitle className="pr-6 text-lg font-semibold">{title}</DialogTitle><DialogDescription className="mt-2 text-sm leading-6 text-muted-foreground">{description}</DialogDescription><div className="mt-6">{children}</div></DialogContent></Dialog>
}
