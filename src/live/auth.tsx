import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { api, supabase, type Me } from './api'

type AuthState = { session: Session | null; me: Me | null; loading: boolean; refresh: () => Promise<Me | null>; signOut: () => Promise<void> }
const Context = createContext<AuthState | null>(null)
export function useLiveAuth() { const value = useContext(Context); if (!value) throw new Error('Live auth provider missing'); return value }
export function LiveAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  async function refresh() { const { data } = await supabase!.auth.getSession(); if (!data.session) { setMe(null); return null }; const user = await api<Me>('/me'); setMe(user); return user }
  useEffect(() => {
    let active = true
    void supabase!.auth.getSession().then(async ({ data }) => { if (!active) return; setSession(data.session); if (data.session) try { await refresh() } catch { if (active) setMe(null) } if (active) setLoading(false) })
    const { data: listener } = supabase!.auth.onAuthStateChange((_event, next) => { if (!active) return; setSession(next); if (!next) setMe(null); else setTimeout(() => { if (active) void refresh().catch(() => setMe(null)) }, 0) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  async function signOut() { await supabase!.auth.signOut(); setSession(null); setMe(null) }
  return <Context.Provider value={{ session, me, loading, refresh, signOut }}>{children}</Context.Provider>
}
export function Protected({ children, role, allowIncomplete = false }: { children: ReactNode; role?: 'CLIENT' | 'FREELANCER'; allowIncomplete?: boolean }) {
  const { session, me, loading, refresh } = useLiveAuth(); const location = useLocation()
  if (loading) return <div className="container page-shell">Loading account…</div>
  if (!session) return <Navigate to="/login" state={{ from: location.pathname }} replace/>
  if (!me) return <div className="container page-shell"><p>Your account could not be loaded.</p><button onClick={() => void refresh()}>Try again</button></div>
  if (!allowIncomplete && !me.onboardingComplete) return <Navigate to="/onboarding" replace/>
  if (role && !me.roles.includes(role)) return <Navigate to="/settings" replace/>
  return <>{children}</>
}
