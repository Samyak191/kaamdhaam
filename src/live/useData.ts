import { useCallback, useEffect, useState } from 'react'

export function useData<T>(key: string, load: () => Promise<T>, pollMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => { try { const next = await load(); setData(next); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load data.') } finally { setLoading(false) } }, [key])
  useEffect(() => { setLoading(true); void refresh(); if (!pollMs) return; const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, pollMs); return () => window.clearInterval(timer) }, [refresh, pollMs])
  return { data, error, loading, refresh }
}
