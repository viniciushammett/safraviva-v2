import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { preferencesRepository } from '@/repositories/preferences-repository'
import { workspaceRepository } from '@/repositories/workspace-repository'
import type { InterfacePreferences } from '@/types/workspace'

interface WorkspaceState {
  activeWorkspaceId: string | null
  preferences: InterfacePreferences
  selectWorkspace: (id: string) => void
  toggleSidebar: () => void
}
export const useWorkspaceStore = create<WorkspaceState>()(persist((set) => ({
  activeWorkspaceId: null,
  preferences: { sidebarCollapsed: false },
  selectWorkspace: (id) => {
    if (workspaceRepository.findById(id)) set({ activeWorkspaceId: id })
  },
  toggleSidebar: () => set((state) => ({ preferences: { sidebarCollapsed: !state.preferences.sidebarCollapsed } })),
}), {
  name: 'safraviva-workspace', version: 1,
  storage: createJSONStorage(() => preferencesRepository),
  partialize: ({ activeWorkspaceId, preferences }) => ({ activeWorkspaceId, preferences }),
  merge: (persisted, current) => {
    const data = persisted as Partial<WorkspaceState> | undefined
    return {
      ...current,
      activeWorkspaceId: typeof data?.activeWorkspaceId === 'string' && workspaceRepository.findById(data.activeWorkspaceId) ? data.activeWorkspaceId : null,
      preferences: { sidebarCollapsed: data?.preferences?.sidebarCollapsed === true },
    }
  },
}))
export function useActiveWorkspace() {
  const id = useWorkspaceStore((state) => state.activeWorkspaceId)
  return workspaceRepository.findById(id)
}
