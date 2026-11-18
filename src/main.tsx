import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { JobsPage } from './pages/JobsPage'
import { JobDetailsPage } from './pages/JobDetailsPage'
import { TalentPage, EnterprisePage, AuthPage, SupportPage } from './pages/SecondaryPages'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Routes><Route element={<SiteLayout />}><Route path="/" element={<HomePage/>}/><Route path="/jobs" element={<JobsPage/>}/><Route path="/jobs/:id" element={<JobDetailsPage/>}/><Route path="/talent" element={<TalentPage/>}/><Route path="/enterprise" element={<EnterprisePage/>}/><Route path="/login" element={<AuthPage mode="login"/>}/><Route path="/signup" element={<AuthPage mode="signup"/>}/><Route path="/support" element={<SupportPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Route></Routes></BrowserRouter></React.StrictMode>)
