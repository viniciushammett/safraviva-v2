import { workspaces } from '@/data/workspaces'

// Async contract allows replacing local data with REST without changing consumers.
export const workspaceRepository = {
  async list() { return workspaces },
  findById(id: string | null) { return workspaces.find((workspace) => workspace.id === id) ?? null },
}
