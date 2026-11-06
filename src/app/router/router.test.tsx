import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { routes } from '@/app/router/router'
import { FeedbackProvider } from '@/app/providers/feedback-provider'
import { navigation } from '@/data/navigation'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { activateWorkspace } from '@/services/workspace-service'

function mount(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<FeedbackProvider><RouterProvider router={router} /></FeedbackProvider>)
  return router
}
beforeEach(() => { localStorage.clear(); useWorkspaceStore.setState({ activeWorkspaceId: null, preferences: { sidebarCollapsed: false } }) })
afterEach(cleanup)
describe('workspace navigation', () => {
  it('requires workspace selection for direct access', async () => {
    const router = mount('/producer/production')
    await screen.findByRole('heading', { name: /Selecione seu ambiente/ })
    expect(router.state.location.pathname).toBe('/')
  })
  it('opens a selected workspace and persists only its ID and preferences', async () => {
    const router = mount('/')
    const buttons = await screen.findAllByRole('button', { name: /Acessar ambiente/ })
    fireEvent.click(buttons[0])
    await screen.findByRole('heading', { name: 'Olá, João.' })
    expect(router.state.location.pathname).toBe('/producer/overview')
    const persisted = JSON.parse(localStorage.getItem('safraviva-workspace')!).state
    expect(persisted).toEqual({ activeWorkspaceId: 'santa-clara', preferences: { sidebarCollapsed: false } })
    act(() => useWorkspaceStore.setState({ activeWorkspaceId: null }))
    // Restore the browser's previously saved snapshot, then hydrate a new session.
    localStorage.setItem('safraviva-workspace', JSON.stringify({ state: persisted, version: 1 }))
    await act(async () => { await useWorkspaceStore.persist.rehydrate() })
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('santa-clara')
  })
  it('switches organization without reloading and updates navigation', async () => {
    activateWorkspace('santa-clara')
    const router = mount('/producer/production')
    fireEvent.keyDown(screen.getByRole('button', { name: /Alternar ambiente/ }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name: /Mercado Bom Preço/ }))
    await screen.findByRole('heading', { name: 'Olá, Mariana.' })
    expect(router.state.location.pathname).toBe('/buyer/overview')
    expect(screen.getByRole('navigation').textContent).toContain('Mercado Agrícola')
    expect(screen.getByRole('navigation').textContent).not.toContain('Produção e Ofertas')
  })
  it.each(navigation.producer.concat(navigation.buyer))('renders $path', async ({ path, label }) => {
    activateWorkspace(path.startsWith('/producer') ? 'santa-clara' : 'bom-preco')
    const router = mount(path)
    await waitFor(() => expect(screen.getAllByRole('heading').length).toBeGreaterThan(0))
    expect(router.state.location.pathname).toBe(path)
    expect(screen.getByRole('navigation').textContent).toContain(label)
    if (!path.endsWith('overview')) expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(label)
  })
  it('redirects buyer routes to the producer overview', async () => {
    activateWorkspace('santa-clara')
    const router = mount('/buyer/orders')
    await screen.findByRole('heading', { name: 'Olá, João.' })
    expect(router.state.location.pathname).toBe('/producer/overview')
  })
  it('handles unknown addresses', async () => {
    mount('/unknown')
    await screen.findByRole('heading', { name: 'Página não encontrada' })
  })
  it('ignores invalid workspace IDs', () => {
    activateWorkspace('santa-clara')
    useWorkspaceStore.getState().selectWorkspace('invalid')
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('santa-clara')
  })
  it('recovers from stale persisted organizations', async () => {
    localStorage.setItem('safraviva-workspace', JSON.stringify({ state: { activeWorkspaceId: 'removed', preferences: { sidebarCollapsed: 'invalid' } }, version: 1 }))
    await useWorkspaceStore.persist.rehydrate()
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe(null)
    expect(useWorkspaceStore.getState().preferences.sidebarCollapsed).toBe(false)
  })
})
