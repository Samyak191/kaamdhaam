import type { Contract, DemoJob, DemoRole, DemoState, Milestone, MilestoneStatus, Notification, ProjectStatus, Proposal, ProposedMilestone, Review, UserSettings } from './demoModels'
import { demoUserId, formatINR, rupees, uid } from './demoModels'
import { createSeedState } from './demoSeed'

export const DEMO_STORAGE_KEY = 'kaamdham-demo-v2'
export const PLATFORM_COMMISSION_PERCENT = 10
export const CLIENT_PROTECTION_PERCENT = 2.5
const now = () => new Date().toISOString()

function notice(userId: string, kind: Notification['kind'], title: string, body: string, href: string): Notification { return { id: uid('notice'), userId, kind, title, body, href, read: false, at: now() } }
function currentFreelancerId(state: DemoState) { return state.role === 'freelancer' || state.role === null ? 'f-aarav' : null }

export function loadDemoState(): DemoState {
  const seed = createSeedState()
  try {
    const stored = JSON.parse(localStorage.getItem(DEMO_STORAGE_KEY) || 'null') as DemoState | null
    if (stored && stored.version === 2 && ['users', 'profiles', 'clients', 'jobs', 'proposals', 'contracts', 'milestones', 'conversations', 'messages', 'notifications', 'reviews', 'transactions', 'invoices', 'disputes', 'kycRequests', 'savedJobs', 'savedProfiles'].every(key => Array.isArray(stored[key as keyof DemoState])) && stored.settings && typeof stored.settings === 'object') return stored
    const savedJobs = JSON.parse(localStorage.getItem('kd-saved-jobs') || '[]')
    if (Array.isArray(savedJobs)) seed.savedJobs = savedJobs.filter((id): id is string => typeof id === 'string')
    const oldProposals = JSON.parse(localStorage.getItem('kd-proposals') || '[]')
    if (Array.isArray(oldProposals)) for (const old of oldProposals) {
      const job = seed.jobs.find(item => item.id === old.jobId)
      if (!job || !Number.isFinite(Number(old.bid))) continue
      seed.proposals.push({ id: uid('proposal'), jobId: job.id, freelancerId: 'f-aarav', clientId: job.clientId, bidPaise: rupees(Number(old.bid)), delivery: String(old.delivery || 'To be discussed'), coverLetter: String(old.letter || ''), milestonePlan: Array.isArray(old.milestones) ? old.milestones.map((item: { title?: string; amount?: string }) => ({ title: String(item.title || ''), amountPaise: rupees(Number(item.amount || 0)) })).filter((item: ProposedMilestone) => item.title) : [], attachment: String(old.attachment || ''), status: 'Pending', createdAt: String(old.submittedAt || now()) })
    }
    const oldRole = localStorage.getItem('kd-demo-role')?.toLowerCase()
    if (oldRole === 'freelancer' || oldRole === 'client') seed.role = oldRole
  } catch { /* Start with the deterministic seed if browser data is malformed. */ }
  return seed
}
export function saveDemoState(state: DemoState) { localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)) }
export function resetDemoState(): DemoState { localStorage.removeItem(DEMO_STORAGE_KEY); localStorage.removeItem('kd-saved-jobs'); localStorage.removeItem('kd-proposals'); localStorage.removeItem('kd-demo-role'); localStorage.removeItem('kd-demo-email'); return createSeedState() }

export interface ProjectInput { title: string; category: string; description: string; deliverables: string[]; skills: string[]; experience: DemoJob['experience']; duration: string; type: DemoJob['type']; minimumRupees: number; maximumRupees: number; deadline: string; attachments: string[] }
export function saveProject(state: DemoState, input: ProjectInput, status: ProjectStatus, existingId?: string): { state: DemoState; id: string } {
  const original = existingId ? state.jobs.find(item => item.id === existingId && item.clientId === 'c-nira') : undefined
  if (existingId && !original) throw new Error('This demo project cannot be edited.')
  const id = original?.id || uid('job')
  const budget = input.type === 'Hourly' ? `${formatINR(rupees(input.minimumRupees))}–${formatINR(rupees(input.maximumRupees))}/hr` : `${formatINR(rupees(input.minimumRupees))}–${formatINR(rupees(input.maximumRupees))}`
  const job: DemoJob = { id, title: input.title.trim(), category: input.category, description: input.description.trim().slice(0, 170), details: input.description.trim(), skills: input.skills, budget, budgetMin: input.minimumRupees, budgetMinPaise: rupees(input.minimumRupees), budgetMaxPaise: rupees(input.maximumRupees), type: input.type, location: 'Remote', remote: true, posted: original?.posted || 'just now', daysAgo: original?.daysAgo || 0, proposals: original?.proposals || 0, averageBid: original?.averageBid || '—', experience: input.experience, timeline: input.duration, client: 'Nira Skincare', clientLocation: 'Mumbai, Maharashtra', deliverables: input.deliverables, clientId: 'c-nira', status, createdAt: original?.createdAt || now(), deadline: input.deadline, attachments: input.attachments }
  const jobs = original ? state.jobs.map(item => item.id === id ? job : item) : [job, ...state.jobs]
  return { id, state: { ...state, jobs } }
}

export interface ProposalInput { bidRupees: number; delivery: string; coverLetter: string; milestonePlan: { title: string; amountRupees: number }[]; attachment?: string }
export function createProposal(state: DemoState, jobId: string, input: ProposalInput): DemoState {
  const job = state.jobs.find(item => item.id === jobId && item.status === 'Open')
  if (!job) throw new Error('This job is no longer open for proposals.')
  const freelancerId = currentFreelancerId(state)
  if (!freelancerId) throw new Error('Switch to the freelancer demo to submit a proposal.')
  if (state.proposals.some(item => item.jobId === jobId && item.freelancerId === freelancerId)) throw new Error('You already sent a proposal for this project.')
  if (!Number.isSafeInteger(input.bidRupees) || input.bidRupees <= 0 || !input.delivery.trim() || input.coverLetter.trim().length < 40) throw new Error('Enter a valid bid, timeline, and cover letter of at least 40 characters.')
  const plans = input.milestonePlan.filter(item => item.title.trim()).map(item => ({ title: item.title.trim(), amountPaise: rupees(item.amountRupees) }))
  if (plans.length && plans.reduce((total, item) => total + item.amountPaise, 0) !== rupees(input.bidRupees)) throw new Error('Milestone amounts must add up to your bid.')
  const proposal: Proposal = { id: uid('proposal'), jobId, freelancerId, clientId: job.clientId, bidPaise: rupees(input.bidRupees), delivery: input.delivery.trim(), coverLetter: input.coverLetter.trim(), milestonePlan: plans, attachment: input.attachment, status: 'Pending', createdAt: now() }
  return { ...state, proposals: [proposal, ...state.proposals], jobs: state.jobs.map(item => item.id === jobId ? { ...item, proposals: item.proposals + 1, averageBid: formatINR(proposal.bidPaise) } : item), notifications: [notice(job.clientId, 'proposal', 'New proposal received', `${state.users.find(user => user.id === freelancerId)?.name || 'A freelancer'} bid on ${job.title}.`, '/dashboard/client/proposals'), ...state.notifications] }
}

export function setProposalStatus(state: DemoState, id: string, status: 'Shortlisted' | 'Rejected'): DemoState {
  const proposal = state.proposals.find(item => item.id === id)
  if (!proposal || proposal.status === 'Accepted') throw new Error('This proposal can no longer be changed.')
  return { ...state, proposals: state.proposals.map(item => item.id === id ? { ...item, status } : item), notifications: [notice(proposal.freelancerId, 'proposal', `Proposal ${status.toLowerCase()}`, `Your proposal has been ${status.toLowerCase()}.`, '/dashboard/freelancer/proposals'), ...state.notifications] }
}

export function hireProposal(state: DemoState, id: string): { state: DemoState; contractId: string } {
  const proposal = state.proposals.find(item => item.id === id)
  const job = proposal && state.jobs.find(item => item.id === proposal.jobId)
  if (!proposal || !job || job.status !== 'Open' || proposal.status === 'Rejected' || state.contracts.some(item => item.proposalId === id)) throw new Error('This proposal cannot be hired.')
  const contractId = uid('contract')
  const end = new Date(Date.now() + 30 * 86400000).toISOString()
  const contract: Contract = { id: contractId, jobId: job.id, proposalId: id, clientId: proposal.clientId, freelancerId: proposal.freelancerId, valuePaise: proposal.bidPaise, status: 'Active', startAt: now(), deadline: end, description: job.details, deliverables: job.deliverables }
  const plan = proposal.milestonePlan.length && proposal.milestonePlan.reduce((sum, item) => sum + item.amountPaise, 0) === proposal.bidPaise ? proposal.milestonePlan : [{ title: 'Project delivery', amountPaise: proposal.bidPaise }]
  const milestones: Milestone[] = plan.map(item => ({ id: uid('milestone'), contractId, title: item.title, description: `Deliver ${item.title.toLowerCase()} for ${job.title}.`, amountPaise: item.amountPaise, deadline: end, status: 'Pending Funding', attachments: [] }))
  const updated: DemoState = { ...state, proposals: state.proposals.map(item => item.id === id ? { ...item, status: 'Accepted' } : item.jobId === job.id && item.status !== 'Rejected' ? { ...item, status: 'Rejected' } : item), jobs: state.jobs.map(item => item.id === job.id ? { ...item, status: 'In Progress' } : item), contracts: [contract, ...state.contracts], milestones: [...milestones, ...state.milestones], notifications: [notice(proposal.freelancerId, 'contract', 'You were hired', `${job.client} hired you for ${job.title}.`, `/contracts/${contractId}`), notice(proposal.clientId, 'contract', 'Contract created', `Your demo contract for ${job.title} is ready.`, `/contracts/${contractId}`), ...state.notifications] }
  return { state: updated, contractId }
}

export type MilestoneAction = 'fund' | 'start' | 'submit' | 'resubmit' | 'revise' | 'approve' | 'release' | 'dispute'
const transitions: Record<MilestoneAction, { from: MilestoneStatus[]; to: MilestoneStatus; role: DemoRole }> = {
  fund: { from: ['Pending Funding'], to: 'Funded', role: 'client' },
  start: { from: ['Funded'], to: 'In Progress', role: 'freelancer' },
  submit: { from: ['In Progress'], to: 'Submitted', role: 'freelancer' },
  resubmit: { from: ['Revision Requested'], to: 'Submitted', role: 'freelancer' },
  revise: { from: ['Submitted'], to: 'Revision Requested', role: 'client' },
  approve: { from: ['Submitted'], to: 'Approved', role: 'client' },
  release: { from: ['Approved'], to: 'Released', role: 'client' },
  dispute: { from: ['Funded', 'In Progress', 'Submitted', 'Revision Requested', 'Approved'], to: 'Disputed', role: 'client' },
}
export function changeMilestone(state: DemoState, id: string, action: MilestoneAction, details = ''): DemoState {
  const milestone = state.milestones.find(item => item.id === id)
  const contract = milestone && state.contracts.find(item => item.id === milestone.contractId)
  const transition = transitions[action]
  if (!milestone || !contract || state.role !== transition.role || !transition.from.includes(milestone.status) || contract.status !== 'Active') throw new Error('This milestone action is not available in its current state.')
  if ((action === 'submit' || action === 'resubmit' || action === 'dispute') && !details.trim()) throw new Error('Add a short note before continuing.')
  const nextMilestones = state.milestones.map(item => item.id === id ? { ...item, status: transition.to, submission: action === 'submit' || action === 'resubmit' ? details.trim() : item.submission } : item)
  const recipient = state.role === 'client' ? contract.freelancerId : contract.clientId
  const titles: Record<MilestoneAction, string> = { fund: 'Milestone funded in demo', start: 'Work started', submit: 'Deliverables submitted', resubmit: 'Deliverables resubmitted', revise: 'Revision requested', approve: 'Milestone approved', release: 'Milestone released in demo', dispute: 'Milestone disputed' }
  let next: DemoState = { ...state, milestones: nextMilestones, notifications: [notice(recipient, 'milestone', titles[action], milestone.title, `/contracts/${contract.id}?tab=milestones`), ...state.notifications] }
  if (action === 'fund') next = { ...next, transactions: [{ id: uid('transaction'), contractId: contract.id, milestoneId: id, userId: contract.clientId, kind: 'Milestone funding', amountPaise: milestone.amountPaise, status: 'Simulated', at: now() }, ...next.transactions] }
  if (action === 'dispute') next = { ...next, contracts: next.contracts.map(item => item.id === contract.id ? { ...item, status: 'Disputed' } : item), disputes: [{ id: uid('dispute'), contractId: contract.id, milestoneId: id, reason: details.trim(), status: 'Open', createdAt: now() }, ...next.disputes] }
  if (action === 'release') {
    const transactionId = uid('transaction')
    const invoiceId = uid('invoice')
    next = { ...next, transactions: [{ id: transactionId, contractId: contract.id, milestoneId: id, userId: contract.freelancerId, kind: 'Milestone release', amountPaise: milestone.amountPaise, status: 'Simulated', at: now() }, ...next.transactions], invoices: [{ id: invoiceId, transactionId, contractId: contract.id, number: `KD-DEMO-${new Date().getFullYear()}-${String(next.invoices.length + 1).padStart(3, '0')}`, issuedAt: now(), subtotalPaise: milestone.amountPaise, taxPaise: 0, totalPaise: milestone.amountPaise }, ...next.invoices] }
    if (nextMilestones.filter(item => item.contractId === contract.id).every(item => item.status === 'Released')) next = { ...next, contracts: next.contracts.map(item => item.id === contract.id ? { ...item, status: 'Completed' } : item), jobs: next.jobs.map(item => item.id === contract.jobId ? { ...item, status: 'Completed' } : item), notifications: [notice(contract.clientId, 'review', 'Contract completed', 'You can now leave a review for this collaboration.', '/dashboard/client/reviews'), notice(contract.freelancerId, 'review', 'Contract completed', 'You can now review your client.', '/dashboard/freelancer/reviews'), ...next.notifications] }
  }
  return next
}

export function getAvailableBalance(state: DemoState, freelancerId = 'f-aarav') { const earned = state.transactions.filter(item => item.userId === freelancerId && item.kind === 'Milestone release').reduce((sum, item) => sum + item.amountPaise, 0); const withdrawn = state.transactions.filter(item => item.userId === freelancerId && item.kind === 'Withdrawal').reduce((sum, item) => sum + item.amountPaise, 0); return Math.max(0, earned - Math.round(earned * PLATFORM_COMMISSION_PERCENT / 100) - withdrawn) }
export function requestWithdrawal(state: DemoState, amountPaise: number): DemoState { if (state.role !== 'freelancer' || !Number.isSafeInteger(amountPaise) || amountPaise <= 0 || amountPaise > getAvailableBalance(state)) throw new Error('Enter an amount within the available demo balance.'); return { ...state, transactions: [{ id: uid('transaction'), userId: 'f-aarav', kind: 'Withdrawal', amountPaise, status: 'Simulated', at: now() }, ...state.transactions], notifications: [notice('f-aarav', 'system', 'Demo withdrawal recorded', `${formatINR(amountPaise)} was recorded as a simulated withdrawal.`, '/dashboard/freelancer/earnings'), ...state.notifications] } }

export function startConversation(state: DemoState, otherUserId: string, jobId?: string): { state: DemoState; id: string } { const self = demoUserId(state.role || 'client'); const existing = state.conversations.find(item => item.participants.includes(self) && item.participants.includes(otherUserId) && item.jobId === jobId); if (existing) return { state, id: existing.id }; const id = uid('conversation'); return { state: { ...state, conversations: [{ id, participants: [self, otherUserId], jobId, lastReadAt: { [self]: now() } }, ...state.conversations] }, id } }
export function sendMessage(state: DemoState, conversationId: string, body: string, attachment?: string): DemoState { const conversation = state.conversations.find(item => item.id === conversationId); const self = demoUserId(state.role || 'client'); if (!conversation || !conversation.participants.includes(self) || (!body.trim() && !attachment)) throw new Error('Add a message or attachment.'); const recipient = conversation.participants.find(id => id !== self)!; return { ...state, messages: [...state.messages, { id: uid('message'), conversationId, senderId: self, body: body.trim(), attachment, at: now() }], conversations: state.conversations.map(item => item.id === conversationId ? { ...item, lastReadAt: { ...item.lastReadAt, [self]: now() } } : item), notifications: [notice(recipient, 'message', 'New message', body.trim().slice(0, 80) || 'A file was shared with you.', `/messages/${conversationId}`), ...state.notifications] } }
export function addReview(state: DemoState, contractId: string, rating: number, text: string): DemoState { const contract = state.contracts.find(item => item.id === contractId && item.status === 'Completed'); const reviewerId = demoUserId(state.role || 'client'); if (!contract || ![contract.clientId, contract.freelancerId].includes(reviewerId)) throw new Error('Reviews are available after a completed contract.'); if (state.reviews.some(item => item.contractId === contractId && item.reviewerId === reviewerId)) throw new Error('You already reviewed this contract.'); if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.trim().length < 15) throw new Error('Choose a rating and write at least 15 characters.'); const revieweeId = reviewerId === contract.clientId ? contract.freelancerId : contract.clientId; const review: Review = { id: uid('review'), contractId, reviewerId, revieweeId, rating, text: text.trim(), at: now() }; return { ...state, reviews: [review, ...state.reviews], notifications: [notice(revieweeId, 'review', 'New review received', 'A collaborator left a review for your completed project.', revieweeId === contract.clientId ? '/dashboard/client/reviews' : '/dashboard/freelancer/reviews'), ...state.notifications] } }
export function updateSettings(state: DemoState, userId: string, values: UserSettings): DemoState { return { ...state, settings: { ...state.settings, [userId]: values } } }
