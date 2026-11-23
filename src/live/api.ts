import { createClient } from '@supabase/supabase-js'

export const liveMode = import.meta.env.VITE_APP_MODE === 'live'
const base = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:4000/v1').replace(/\/$/, '')
const url = import.meta.env.VITE_SUPABASE_URL || ''
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
export const supabase = liveMode && url && key ? createClient(url, key, { auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true } }) : null

export interface Page<T> { items: T[]; total: number; limit: number; offset: number }
export interface Me { id: string; email: string; displayName: string | null; roles: Array<'CLIENT' | 'FREELANCER'>; onboardingComplete: boolean; freelancerProfile?: { headline?: string | null; bio?: string | null; locationCity?: string | null; locationState?: string | null } }
export interface Organization { id: string; name: string; slug: string }
export interface Job { id: string; title: string; description: string; budgetPaise: string; status: 'DRAFT' | 'OPEN' | 'HIRED' | 'COMPLETED' | 'CANCELLED'; organization: Organization; skills: string[]; createdAt: string; publishedAt?: string | null; deadline?: string | null }
export interface Freelancer { id: string; displayName: string; headline: string; bio?: string | null; locationCity?: string | null; locationState?: string | null; skills: string[] }
export interface Proposal { id: string; jobId: string; jobTitle?: string; jobStatus?: string; freelancerUserId: string; coverLetter: string; bidPaise: string; deliveryDays: number; status: 'SUBMITTED' | 'SHORTLISTED' | 'REJECTED' | 'HIRED'; createdAt: string; milestones: Array<{ id: string; title: string; amountPaise: string; sequence: number }> }
export interface Milestone { id: string; sequence: number; title: string; amountPaise: string; status: 'PLANNED' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED' | 'CANCELLED' | 'COMPLETED'; revisionNumber: number; submissions: Array<{ id: string; revisionNumber: number; description: string; deliverableUrl?: string | null; submittedAt: string; revisionReason?: string | null }> }
export interface Contract { id: string; jobId: string; jobTitle?: string; organization: Organization; freelancerUserId: string; agreedPaise: string; status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; createdAt: string; conversationId: string; milestones: Milestone[] }
export interface Conversation { id: string; contractId: string; jobTitle: string; contractStatus: string; unreadCount: number; lastSequence: string; lastReadSequence: string; updatedAt: string }
export interface Message { id: string; sequence: string; senderUserId: string; body: string; createdAt: string }
export interface Notification { id: string; type: string; relatedEntityType: string; relatedEntityId: string; metadata?: Record<string, unknown>; createdAt: string; readAt?: string | null }

export const json = (body: unknown) => JSON.stringify(body)
export function inr(paise: string | number | bigint) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(paise) / 100) }
export function paise(value: string) { const number = Number(value); if (!Number.isFinite(number) || number < 100 || !Number.isSafeInteger(Math.round(number * 100))) throw new Error('Enter an amount of at least ₹100.'); return Math.round(number * 100) }
export function dateText(value?: string | null) { return value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—' }

export async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const session = auth ? await supabase?.auth.getSession() : null
  const token = session?.data.session?.access_token
  if (auth && !token) throw new Error('Please log in to continue.')
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${base}${path}`, { ...init, headers })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && auth) void supabase?.auth.signOut({ scope: 'local' })
    const detail = data?.message
    throw new Error(Array.isArray(detail) ? detail.join('; ') : detail || `Request failed (${response.status})`)
  }
  return data as T
}
