import { useState } from 'react'

export function useSavedJobs() {
  const [savedIds, setSavedIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('kd-saved-jobs') || '[]') } catch { return [] } })
  const toggleSaved = (id: string) => setSavedIds(previous => { const next = previous.includes(id) ? previous.filter(x => x !== id) : [...previous, id]; localStorage.setItem('kd-saved-jobs', JSON.stringify(next)); return next })
  return { savedIds, toggleSaved }
}
