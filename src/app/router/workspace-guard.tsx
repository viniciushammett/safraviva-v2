import { Navigate, Outlet } from 'react-router-dom'
import { useActiveWorkspace } from '@/stores/workspace-store'
import type { Profile } from '@/types/workspace'

export function WorkspaceGuard({ profile }: { profile?: Profile }) {
  const workspace = useActiveWorkspace()
  if (!workspace) return <Navigate to="/" replace />
  if (profile && workspace.profile !== profile) {
    return <Navigate to={`/${workspace.profile}/overview`} replace />
  }
  return <Outlet />
}

export function ProfileIndex() {
  const workspace = useActiveWorkspace()
  return <Navigate replace to={workspace ? `/${workspace.profile}/overview` : '/'} />
}
