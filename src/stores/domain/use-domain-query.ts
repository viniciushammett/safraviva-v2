import { useEffect, useState } from 'react'
import { useDomainStore } from '@/stores/domain/domain-store'

// Pass a stable query (useCallback or a module function). No localStorage in React.
export function useDomainQuery<T>(query: () => Promise<T>) {
  const revision = useDomainStore((state) => state.revision)
  const status = useDomainStore((state) => state.status)
  const initializationError = useDomainStore((state) => state.error)
  const [result, setResult] = useState<{ data: T | null; error: string | null; revision: number; query: typeof query | null }>({ data: null, error: null, revision: -1, query: null })
  useEffect(() => {
    if (status !== 'ready') return
    let active = true
    query().then((data) => {
      if (active) setResult({ data, error: null, revision, query })
    }).catch((error: unknown) => {
      if (active) setResult({ data: null, error: error instanceof Error ? error.message : 'Falha ao consultar os dados.', revision, query })
    })
    return () => { active = false }
  }, [query, revision, status])
  const current = result.revision === revision && result.query === query && status === 'ready'
  return { data: current ? result.data : null, error: initializationError ?? (current ? result.error : null), loading: status !== 'error' && !current }
}
