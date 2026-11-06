import type { StateStorage } from 'zustand/middleware'

// Persistence is optional: private mode, quotas and blocked storage cannot stop navigation.
export const preferencesRepository: StateStorage = {
  getItem(name) { try { return localStorage.getItem(name) } catch { return null } },
  setItem(name, value) { try { localStorage.setItem(name, value) } catch { /* Session remains usable. */ } },
  removeItem(name) { try { localStorage.removeItem(name) } catch { /* Session remains usable. */ } },
}
