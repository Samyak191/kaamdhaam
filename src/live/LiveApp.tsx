import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { LiveAuthProvider, Protected, useLiveAuth } from './auth'
import { LiveDashboardShell, LiveSiteLayout, Unavailable } from './shell'
import { supabase } from './api'

const AuthPage = lazy(() => import('./account').then(m => ({ default: m.AuthPage })))
const ForgotPassword = lazy(() => import('./account').then(m => ({ default: m.ForgotPassword })))
const ResetPassword = lazy(() => import('./account').then(m => ({ default: m.ResetPassword })))
const Onboarding = lazy(() => import('./account').then(m => ({ default: m.Onboarding })))
const Settings = lazy(() => import('./account').then(m => ({ default: m.Settings })))
const Notifications = lazy(() => import('./activity').then(m => ({ default: m.Notifications })))
const Messages = lazy(() => import('./activity').then(m => ({ default: m.Messages })))
const ContractDetail = lazy(() => import('./contracts').then(m => ({ default: m.ContractDetail })))
const ContractsList = lazy(() => import('./contracts').then(m => ({ default: m.ContractsList })))
const LiveHome = lazy(() => import('./discovery').then(m => ({ default: m.LiveHome })))
const LiveJobDetails = lazy(() => import('./discovery').then(m => ({ default: m.LiveJobDetails })))
const LiveJobs = lazy(() => import('./discovery').then(m => ({ default: m.LiveJobs })))
const LiveTalent = lazy(() => import('./discovery').then(m => ({ default: m.LiveTalent })))
const LiveTalentDetails = lazy(() => import('./discovery').then(m => ({ default: m.LiveTalentDetails })))
const MyProjects = lazy(() => import('./projects').then(m => ({ default: m.MyProjects })))
const Overview = lazy(() => import('./projects').then(m => ({ default: m.Overview })))
const ProjectEditor = lazy(() => import('./projects').then(m => ({ default: m.ProjectEditor })))
const Proposals = lazy(() => import('./projects').then(m => ({ default: m.Proposals })))

const noPayments = <Unavailable title="Payments are not available">Contracts track agreed work and approvals, but KaamDhaam does not collect, hold, release, or withdraw money.</Unavailable>
function AuthLinkNotice() {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const inspect = () => {
      const params = new URLSearchParams(window.location.hash.slice(1))
      if (!params.has('error') && !params.has('error_code')) return
      setFailed(true)
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
    inspect()
    window.addEventListener('hashchange', inspect)
    return () => window.removeEventListener('hashchange', inspect)
  }, [])
  return failed ? <div className="container page-shell" role="alert"><p className="form-error">This email link is invalid, expired, or already used. Please request a new link or try logging in.</p><Link to="/forgot-password">Request a new recovery link</Link> · <Link to="/login">Log in</Link></div> : null
}
export function LiveApp() { if (!supabase) return <div className="container page-shell"><h1>Live mode needs Supabase configuration</h1><p>Set the dedicated project URL and public publishable key in the ignored frontend .env.local file, then restart Vite.</p></div>; return <LiveAuthProvider><LiveRoutes/></LiveAuthProvider> }
function LiveRoutes() { const { session } = useLiveAuth(); return <BrowserRouter><AuthLinkNotice/><Suspense fallback={<div className="container page-shell">Loading page…</div>}><Routes key={session?.user.id ?? 'anonymous'}><Route element={<LiveSiteLayout/>}>
  <Route path="/" element={<LiveHome/>}/><Route path="/jobs" element={<LiveJobs/>}/><Route path="/jobs/:id" element={<LiveJobDetails/>}/><Route path="/talent" element={<LiveTalent/>}/><Route path="/talent/:id" element={<LiveTalentDetails/>}/>
  <Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/verify-otp" element={<Navigate to="/forgot-password" replace/>}/><Route path="/onboarding" element={<Onboarding/>}/><Route path="/settings" element={<Protected><Settings/></Protected>}/>
  <Route path="/dashboard/client" element={<LiveDashboardShell role="client"/>}><Route index element={<Overview role="client"/>}/><Route path="projects" element={<MyProjects/>}/><Route path="projects/new" element={<ProjectEditor/>}/><Route path="projects/:id/edit" element={<ProjectEditor/>}/><Route path="proposals" element={<Proposals role="client"/>}/><Route path="contracts" element={<ContractsList/>}/><Route path="milestones" element={<ContractsList/>}/><Route path="settings" element={<Settings/>}/><Route path="payments" element={noPayments}/><Route path="reviews" element={<Unavailable title="Reviews unavailable"/>}/></Route>
  <Route path="/dashboard/freelancer" element={<LiveDashboardShell role="freelancer"/>}><Route index element={<Overview role="freelancer"/>}/><Route path="proposals" element={<Proposals role="freelancer"/>}/><Route path="contracts" element={<ContractsList/>}/><Route path="milestones" element={<ContractsList/>}/><Route path="settings" element={<Settings/>}/><Route path="earnings" element={noPayments}/><Route path="saved" element={<Unavailable title="Saved jobs unavailable"/>}/><Route path="reviews" element={<Unavailable title="Reviews unavailable"/>}/></Route>
  <Route path="/contracts/:id" element={<Protected><ContractDetail/></Protected>}/><Route path="/messages" element={<Protected><Messages/></Protected>}/><Route path="/messages/:id" element={<Protected><Messages/></Protected>}/><Route path="/notifications" element={<Protected><Notifications/></Protected>}/>
  <Route path="/invoices/:id" element={<Protected>{noPayments}</Protected>}/><Route path="/dashboard/admin/*" element={<Protected><Unavailable title="Admin access unavailable">Administrative access cannot be granted through this frontend.</Unavailable></Protected>}/><Route path="/enterprise" element={<Unavailable title="Enterprise">Enterprise services are not available in the live marketplace yet.</Unavailable>}/><Route path="/support" element={<Unavailable title="Support">Contact the KaamDhaam project team for this local development build.</Unavailable>}/>
  <Route path="*" element={<Navigate to="/" replace/>}/>
</Route></Routes></Suspense></BrowserRouter> }
