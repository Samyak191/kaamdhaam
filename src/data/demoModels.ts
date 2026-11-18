import type { Job } from './marketplace'

export type DemoRole = 'freelancer' | 'client' | 'admin'
export type ProjectStatus = 'Draft' | 'Open' | 'In Progress' | 'Completed' | 'Cancelled'
export type ProposalStatus = 'Pending' | 'Shortlisted' | 'Accepted' | 'Rejected'
export type ContractStatus = 'Pending' | 'Active' | 'Completed' | 'Cancelled' | 'Disputed'
export type MilestoneStatus = 'Pending Funding' | 'Funded' | 'In Progress' | 'Submitted' | 'Revision Requested' | 'Approved' | 'Disputed' | 'Released'

export interface User { id: string; name: string; role: DemoRole; city: string; status: 'Active' | 'Suspended'; joinedAt: string }
export interface PortfolioItem { id: string; title: string; category: string; description: string; technologies: string[]; imageIndex: number }
export interface FreelancerProfile { id: string; userId: string; name: string; title: string; category: string; city: string; ratePaise: number; rating: number; completedProjects: number; skills: string[]; experienceYears: number; availability: 'Available now' | 'Available soon' | 'Booked'; verified: boolean; about: string; portfolio: PortfolioItem[]; experience: string[]; education: string; certifications: string[]; photoIndex: number }
export interface ClientProfile { id: string; userId: string; company: string; city: string; industry: string; verified: boolean }
export interface DemoJob extends Job { clientId: string; status: ProjectStatus; createdAt: string; deadline?: string; budgetMinPaise: number; budgetMaxPaise: number; attachments?: string[] }
export interface ProposedMilestone { title: string; amountPaise: number }
export interface Proposal { id: string; jobId: string; freelancerId: string; clientId: string; bidPaise: number; delivery: string; coverLetter: string; milestonePlan: ProposedMilestone[]; attachment?: string; status: ProposalStatus; createdAt: string }
export interface Contract { id: string; jobId: string; proposalId: string; clientId: string; freelancerId: string; valuePaise: number; status: ContractStatus; startAt: string; deadline: string; description: string; deliverables: string[] }
export interface Milestone { id: string; contractId: string; title: string; description: string; amountPaise: number; deadline: string; status: MilestoneStatus; submission?: string; attachments: string[] }
export interface Conversation { id: string; participants: string[]; jobId?: string; contractId?: string; lastReadAt: Record<string, string> }
export interface Message { id: string; conversationId: string; senderId: string; body: string; at: string; attachment?: string }
export interface Notification { id: string; userId: string; kind: 'proposal' | 'contract' | 'milestone' | 'message' | 'review' | 'system'; title: string; body: string; href: string; read: boolean; at: string }
export interface Review { id: string; contractId: string; reviewerId: string; revieweeId: string; rating: number; text: string; at: string }
export interface Transaction { id: string; contractId?: string; milestoneId?: string; userId: string; kind: 'Milestone release' | 'Withdrawal' | 'Milestone funding'; amountPaise: number; status: 'Simulated' | 'Pending'; at: string }
export interface Invoice { id: string; transactionId: string; contractId: string; number: string; issuedAt: string; subtotalPaise: number; taxPaise: number; totalPaise: number }
export interface Dispute { id: string; contractId: string; milestoneId: string; reason: string; status: 'Open' | 'Resolved' | 'Closed'; createdAt: string; resolution?: string }
export interface KycRequest { id: string; userId: string; reference: string; status: 'Pending' | 'Approved' | 'Rejected'; submittedAt: string }
export interface UserSettings { displayName: string; city: string; headline: string; emailUpdates: boolean; inAppAlerts: boolean; profileVisibility: 'Public' | 'Private'; payoutPreference: 'UPI' | 'Bank'; twoStepDemo: boolean }

export interface DemoState {
  version: number
  role: DemoRole | null
  users: User[]
  profiles: FreelancerProfile[]
  clients: ClientProfile[]
  jobs: DemoJob[]
  proposals: Proposal[]
  contracts: Contract[]
  milestones: Milestone[]
  conversations: Conversation[]
  messages: Message[]
  notifications: Notification[]
  reviews: Review[]
  transactions: Transaction[]
  invoices: Invoice[]
  disputes: Dispute[]
  kycRequests: KycRequest[]
  settings: Record<string, UserSettings>
  savedJobs: string[]
  savedProfiles: string[]
}

export const rupees = (value: number) => Math.round(value * 100)
export const formatINR = (paise: number, fractions = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: fractions, minimumFractionDigits: fractions }).format(paise / 100)
export const formatDate = (date: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
export const demoUserId = (role: DemoRole) => role === 'freelancer' ? 'f-aarav' : role === 'client' ? 'c-nira' : 'a-admin'
export const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
