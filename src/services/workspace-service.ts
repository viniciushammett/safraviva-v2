import { workspaceRepository } from '@/repositories/workspace-repository'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function activateWorkspace(id: string) {
  const workspace = workspaceRepository.findById(id)
  if (!workspace) throw new Error('Ambiente não encontrado.')
  useWorkspaceStore.getState().selectWorkspace(id)
  return `/${workspace.profile}/overview`
}
