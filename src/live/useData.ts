import { useCallback, useEffect, useRef, useState } from 'react'

export function useData<T>(key: string, load: () => Promise<T>, pollMs = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const loadRef = useRef(load)
  const generation = useRef(0)
  loadRef.current = load
  const refresh = useCallback(async () => { const started = generation.current; try { const next = await loadRef.current(); if (started === generation.current) { setData(next); setError('') } } catch (cause) { if (started === generation.current) setError(cause instanceof Error ? cause.message : 'Unable to load data.') } finally { if (started === generation.current) setLoading(false) } }, [key])
  useEffect(() => { generation.current += 1; setData(null); setLoading(true); void refresh(); if (!pollMs) return () => { generation.current += 1 }; const timer = window.setInterval(() => { if (!document.hidden) void refresh() }, pollMs); return () => { generation.current += 1; window.clearInterval(timer) } }, [refresh, pollMs])
  return { data, error, loading, refresh }
}
