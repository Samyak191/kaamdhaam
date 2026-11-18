import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { DemoRole, DemoState, MilestoneStatus, ProjectStatus, UserSettings } from './demoModels'
import { demoUserId } from './demoModels'
import { addReview, changeMilestone, createProposal, hireProposal, loadDemoState, requestWithdrawal, resetDemoState, saveDemoState, saveProject, sendMessage, setProposalStatus, startConversation, updateSettings, type MilestoneAction, type ProjectInput, type ProposalInput } from './demoService'

type Store = {
  state: DemoState
  setRole: (role: DemoRole | null) => void
  reset: () => void
  toggleSavedJob: (id: string) => void
  toggleSavedProfile: (id: string) => void
  saveProject: (input: ProjectInput, status: ProjectStatus, id?: string) => string
  setJobStatus: (id: string, status: ProjectStatus) => void
  moderateJob: (id: string, status: ProjectStatus) => void
  submitProposal: (jobId: string, input: ProposalInput) => void
  setProposalStatus: (id: string, status: 'Shortlisted' | 'Rejected') => void
  hireProposal: (id: string) => string
  changeMilestone: (id: string, action: MilestoneAction, details?: string) => void
  withdraw: (amountPaise: number) => void
  startConversation: (otherUserId: string, jobId?: string) => string
  sendMessage: (conversationId: string, body: string, attachment?: string) => void
  markConversationRead: (id: string) => void
  submitReview: (contractId: string, rating: number, text: string) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  saveSettings: (values: UserSettings) => void
  setUserStatus: (id: string, status: 'Active' | 'Suspended') => void
  setKycStatus: (id: string, status: 'Approved' | 'Rejected') => void
  resolveDispute: (id: string, resolution: string) => void
  setMilestoneStatusForAdmin: (id: string, status: MilestoneStatus) => void
}

const Context = createContext<Store | null>(null)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadDemoState)
  useEffect(() => saveDemoState(state), [state])
  function change(next: DemoState) { setState(next) }
  const value: Store = {
    state,
    setRole: role => change({ ...state, role }),
    reset: () => change(resetDemoState()),
    toggleSavedJob: id => change({ ...state, savedJobs: state.savedJobs.includes(id) ? state.savedJobs.filter(item => item !== id) : [...state.savedJobs, id] }),
    toggleSavedProfile: id => change({ ...state, savedProfiles: state.savedProfiles.includes(id) ? state.savedProfiles.filter(item => item !== id) : [...state.savedProfiles, id] }),
    saveProject: (input, status, id) => { const result = saveProject(state, input, status, id); change(result.state); return result.id },
    setJobStatus: (id, status) => { const job = state.jobs.find(item => item.id === id); if (!job || job.clientId !== 'c-nira' || (status === 'Open' && state.contracts.some(item => item.jobId === id))) throw new Error('This project status cannot be changed.'); change({ ...state, jobs: state.jobs.map(item => item.id === id ? { ...item, status } : item) }) },
    moderateJob: (id, status) => { const job = state.jobs.find(item => item.id === id); if (!job || state.contracts.some(item => item.jobId === id && item.status === 'Active')) throw new Error('An active contract prevents this project change.'); change({ ...state, jobs: state.jobs.map(item => item.id === id ? { ...item, status } : item) }) },
    submitProposal: (jobId, input) => change(createProposal(state, jobId, input)),
    setProposalStatus: (id, status) => change(setProposalStatus(state, id, status)),
    hireProposal: id => { const result = hireProposal(state, id); change(result.state); return result.contractId },
    changeMilestone: (id, action, details) => change(changeMilestone(state, id, action, details)),
    withdraw: amountPaise => change(requestWithdrawal(state, amountPaise)),
    startConversation: (otherUserId, jobId) => { const result = startConversation(state, otherUserId, jobId); change(result.state); return result.id },
    sendMessage: (id, body, attachment) => change(sendMessage(state, id, body, attachment)),
    markConversationRead: id => { const self = demoUserId(state.role || 'client'); change({ ...state, conversations: state.conversations.map(item => item.id === id ? { ...item, lastReadAt: { ...item.lastReadAt, [self]: new Date().toISOString() } } : item) }) },
    submitReview: (id, rating, text) => change(addReview(state, id, rating, text)),
    markNotificationRead: id => change({ ...state, notifications: state.notifications.map(item => item.id === id ? { ...item, read: true } : item) }),
    markAllNotificationsRead: () => { const self = demoUserId(state.role || 'client'); change({ ...state, notifications: state.notifications.map(item => item.userId === self ? { ...item, read: true } : item) }) },
    saveSettings: values => change(updateSettings(state, demoUserId(state.role || 'freelancer'), values)),
    setUserStatus: (id, status) => change({ ...state, users: state.users.map(item => item.id === id ? { ...item, status } : item) }),
    setKycStatus: (id, status) => change({ ...state, kycRequests: state.kycRequests.map(item => item.id === id ? { ...item, status } : item) }),
    resolveDispute: (id, resolution) => { const dispute = state.disputes.find(item => item.id === id && item.status === 'Open'); if (!dispute || !resolution.trim()) throw new Error('Enter a resolution for the open dispute.'); change({ ...state, disputes: state.disputes.map(item => item.id === id ? { ...item, status: 'Resolved', resolution: resolution.trim() } : item), milestones: state.milestones.map(item => item.id === dispute.milestoneId ? { ...item, status: 'Approved' } : item), contracts: state.contracts.map(item => item.id === dispute.contractId ? { ...item, status: 'Active' } : item) }) },
    setMilestoneStatusForAdmin: (id, status) => change({ ...state, milestones: state.milestones.map(item => item.id === id ? { ...item, status } : item) }),
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useDemo() { const value = useContext(Context); if (!value) throw new Error('DemoProvider is missing'); return value }
export function useCurrentUser() { const { state } = useDemo(); return state.users.find(user => user.id === demoUserId(state.role || 'freelancer')) }
