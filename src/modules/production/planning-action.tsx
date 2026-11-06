import { useInRouterContext, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useActiveWorkspace } from '@/stores/workspace-store'
import { planningHandoff, productionPlanningPath } from './planning-handoff'
function PlanningNavigation({ organizationId }: { organizationId: string }) {
  const navigate = useNavigate()
  return <Button type="button" variant="outline" className="mt-5" onClick={() => navigate(productionPlanningPath, { state: planningHandoff(organizationId) })}>Criar produção a partir do planejamento</Button>
}
export function PlanningAction() {
  const inRouter = useInRouterContext()
  const workspace = useActiveWorkspace()
  return inRouter && workspace?.profile === 'producer' ? <PlanningNavigation organizationId={workspace.id} /> : null
}
