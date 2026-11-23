import React, { lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { DemoProvider } from './data/DemoStore'
import { liveMode } from './live/api'
import { LiveApp } from './live/LiveApp'
import { SiteLayout } from './components/Layout'
import { DashboardShell } from './components/WorkspaceUI'
const HomePage = lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })))
const JobsPage = lazy(() => import('./pages/JobsPage').then(module => ({ default: module.JobsPage })))
const JobDetailsPage = lazy(() => import('./pages/JobDetailsPage').then(module => ({ default: module.JobDetailsPage })))
const EnterprisePage = lazy(() => import('./pages/SecondaryPages').then(module => ({ default: module.EnterprisePage })))
const SupportPage = lazy(() => import('./pages/SecondaryPages').then(module => ({ default: module.SupportPage })))
const TalentPage = lazy(() => import('./pages/TalentPages').then(module => ({ default: module.TalentPage })))
const FreelancerProfilePage = lazy(() => import('./pages/TalentPages').then(module => ({ default: module.FreelancerProfilePage })))
const AuthPage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.AuthPage })))
const ChooseRolePage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.ChooseRolePage })))
const ForgotPasswordPage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.ForgotPasswordPage })))
const VerifyOtpPage = lazy(() => import('./pages/AuthPages').then(module => ({ default: module.VerifyOtpPage })))
const ProjectWizardPage = lazy(() => import('./pages/ProjectWizardPage').then(module => ({ default: module.ProjectWizardPage })))
const ProposalsPage = lazy(() => import('./pages/ProposalsPage').then(module => ({ default: module.ProposalsPage })))
const DashboardOverviewPage = lazy(() => import('./pages/DashboardPages').then(module => ({ default: module.DashboardOverviewPage })))
const SavedJobsPage = lazy(() => import('./pages/DashboardPages').then(module => ({ default: module.SavedJobsPage })))
const MyProjectsPage = lazy(() => import('./pages/DashboardPages').then(module => ({ default: module.MyProjectsPage })))
const ContractsListPage = lazy(() => import('./pages/DashboardPages').then(module => ({ default: module.ContractsListPage })))
const ContractWorkspacePage = lazy(() => import('./pages/ContractPages').then(module => ({ default: module.ContractWorkspacePage })))
const MilestonesPage = lazy(() => import('./pages/ContractPages').then(module => ({ default: module.MilestonesPage })))
const FinancePage = lazy(() => import('./pages/FinancePages').then(module => ({ default: module.FinancePage })))
const InvoicePage = lazy(() => import('./pages/FinancePages').then(module => ({ default: module.InvoicePage })))
const MessagingPage = lazy(() => import('./pages/MessagingPage').then(module => ({ default: module.MessagingPage })))
const NotificationsPage = lazy(() => import('./pages/ReviewsNotificationsSettings').then(module => ({ default: module.NotificationsPage })))
const ReviewsPage = lazy(() => import('./pages/ReviewsNotificationsSettings').then(module => ({ default: module.ReviewsPage })))
const SettingsPage = lazy(() => import('./pages/ReviewsNotificationsSettings').then(module => ({ default: module.SettingsPage })))
const AdminPage = lazy(() => import('./pages/AdminPages').then(module => ({ default: module.AdminPage })))
import './styles.css'
import './workspace.css'
import './dashboard.css'
import './supporting.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  liveMode ? <React.StrictMode><LiveApp/></React.StrictMode> : <React.StrictMode><DemoProvider><BrowserRouter><Routes><Route element={<SiteLayout/>}>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/jobs" element={<JobsPage/>}/>
    <Route path="/jobs/:id" element={<JobDetailsPage/>}/>
    <Route path="/talent" element={<TalentPage/>}/>
    <Route path="/talent/:id" element={<FreelancerProfilePage/>}/>
    <Route path="/enterprise" element={<EnterprisePage/>}/>
    <Route path="/support" element={<SupportPage/>}/>
    <Route path="/login" element={<AuthPage mode="login"/>}/>
    <Route path="/signup" element={<AuthPage mode="signup"/>}/>
    <Route path="/choose-role" element={<ChooseRolePage/>}/>
    <Route path="/forgot-password" element={<ForgotPasswordPage/>}/>
    <Route path="/verify-otp" element={<VerifyOtpPage/>}/>
    <Route path="/messages" element={<MessagingPage/>}/>
    <Route path="/messages/:id" element={<MessagingPage/>}/>
    <Route path="/notifications" element={<NotificationsPage/>}/>
    <Route path="/contracts/:id" element={<ContractWorkspacePage/>}/>
    <Route path="/invoices/:id" element={<InvoicePage/>}/>
    <Route path="/dashboard/freelancer" element={<DashboardShell role="freelancer"/>}>
      <Route index element={<DashboardOverviewPage role="freelancer"/>}/>
      <Route path="saved" element={<SavedJobsPage/>}/>
      <Route path="proposals" element={<ProposalsPage role="freelancer"/>}/>
      <Route path="contracts" element={<ContractsListPage role="freelancer"/>}/>
      <Route path="milestones" element={<MilestonesPage role="freelancer"/>}/>
      <Route path="earnings" element={<FinancePage role="freelancer"/>}/>
      <Route path="reviews" element={<ReviewsPage role="freelancer"/>}/>
      <Route path="settings" element={<SettingsPage role="freelancer"/>}/>
    </Route>
    <Route path="/dashboard/client" element={<DashboardShell role="client"/>}>
      <Route index element={<DashboardOverviewPage role="client"/>}/>
      <Route path="projects" element={<MyProjectsPage/>}/>
      <Route path="projects/new" element={<ProjectWizardPage/>}/>
      <Route path="projects/:id/edit" element={<ProjectWizardPage/>}/>
      <Route path="proposals" element={<ProposalsPage role="client"/>}/>
      <Route path="contracts" element={<ContractsListPage role="client"/>}/>
      <Route path="milestones" element={<MilestonesPage role="client"/>}/>
      <Route path="payments" element={<FinancePage role="client"/>}/>
      <Route path="reviews" element={<ReviewsPage role="client"/>}/>
      <Route path="settings" element={<SettingsPage role="client"/>}/>
    </Route>
    <Route path="/dashboard/admin" element={<DashboardShell role="admin"/>}>
      <Route index element={<AdminPage/>}/>
      <Route path=":section" element={<AdminPage/>}/>
    </Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes></BrowserRouter></DemoProvider></React.StrictMode>,
)
