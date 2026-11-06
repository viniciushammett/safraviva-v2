import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'

const FeedbackContext = createContext<(message: string) => void>(() => {})
// Hook shares the notification context intentionally.
// eslint-disable-next-line react-refresh/only-export-components
export const useFeedback = () => useContext(FeedbackContext)
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  useEffect(() => { if (message) { const timer = setTimeout(() => setMessage(''), 4500); return () => clearTimeout(timer) } }, [message])
  return <FeedbackContext.Provider value={setMessage}>{children}<div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-4 right-4 z-[60] sm:left-auto sm:w-auto">{message && <div className="flex items-center gap-3 rounded-lg border border-[#cce5d7] bg-white p-4 text-sm shadow-lg"><CheckCircle2 className="shrink-0 text-accent" size={20} /><span>{message}</span><button aria-label="Dispensar notificação" onClick={() => setMessage('')} className="ml-2 rounded p-1"><X size={16} /></button></div>}</div></FeedbackContext.Provider>
}
