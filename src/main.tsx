import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { FeedbackProvider } from '@/app/providers/feedback-provider'
import { routes } from '@/app/router/router'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@/styles/globals.css'

// Data bootstrap is independent from workspace selection and does not alter the UI.
void import('@/stores/domain/domain-store').then(({ initializeDomain, connectDomainStorageEvents }) => {
  void initializeDomain()
  const disconnect = connectDomainStorageEvents()
  if (import.meta.hot) import.meta.hot.dispose(disconnect)
})

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(<StrictMode><FeedbackProvider><a href="#main-content" className="skip-link">Pular para o conteúdo</a><RouterProvider router={router} /></FeedbackProvider></StrictMode>)
