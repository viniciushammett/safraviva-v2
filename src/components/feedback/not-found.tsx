import { FileQuestion } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/feedback/empty-state'
import { Button } from '@/components/ui/button'

export function NotFound() {
  return (
    <main id="main-content" className="flex min-h-dvh flex-col items-center justify-center p-6">
      <EmptyState icon={FileQuestion} title="Página não encontrada" description="O endereço acessado não corresponde a uma página da SafraViva." />
      <Button asChild><Link to="/">Selecionar ambiente</Link></Button>
    </main>
  )
}
