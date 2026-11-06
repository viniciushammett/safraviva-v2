export type Profile = 'producer' | 'buyer'
export interface Workspace {
  id: string
  name: string
  profile: Profile
  location: string
  initials: string
  user: { name: string; initials: string; role: string }
}
export interface InterfacePreferences { sidebarCollapsed: boolean }
