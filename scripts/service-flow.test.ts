import assert from 'node:assert/strict'
import { createSeedState } from '../src/data/demoSeed'
import { addReview, changeMilestone, createProposal, getAvailableBalance, hireProposal, loadDemoState, requestWithdrawal, resetDemoState, saveDemoState, saveProject } from '../src/data/demoService'
import { rupees } from '../src/data/demoModels'

const memory = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value) }, removeItem: (key: string) => { memory.delete(key) } } })

let state = createSeedState()
assert.equal(state.jobs.filter(job => job.status === 'Open').length, 12)
assert.equal(state.profiles.length, 12)
assert.equal(new Set(state.users.map(user => user.id)).size, state.users.length)
assert(state.proposals.every(item => state.jobs.some(job => job.id === item.jobId) && state.users.some(user => user.id === item.freelancerId)))
assert(state.contracts.every(item => state.proposals.some(proposal => proposal.id === item.proposalId)))
console.log('PASS stable seed relationships')

const posted = saveProject({ ...state, role: 'client' }, { title: 'Service flow project', category: 'Web Development', description: 'A complete test brief for a responsive commerce experience for a fictional Indian team.', deliverables: ['Responsive storefront'], skills: ['React'], experience: 'Intermediate', duration: '4 weeks', type: 'Fixed price', minimumRupees: 40000, maximumRupees: 60000, deadline: '2026-12-31', attachments: [] }, 'Open')
state = { ...posted.state, role: 'freelancer' }
assert(state.jobs.some(job => job.id === posted.id && job.status === 'Open'))
state = createProposal(state, posted.id, { bidRupees: 50000, delivery: '4 weeks', coverLetter: 'I can build the responsive storefront, test each flow carefully, and provide a clear handover for the fictional team.', milestonePlan: [{ title: 'Delivery', amountRupees: 50000 }] })
assert.throws(() => createProposal(state, posted.id, { bidRupees: 50000, delivery: '4 weeks', coverLetter: 'I can build the responsive storefront, test each flow carefully, and provide a clear handover for the fictional team.', milestonePlan: [] }), /already sent/)
const proposal = state.proposals.find(item => item.jobId === posted.id)!
state = { ...state, role: 'client' }
const hired = hireProposal(state, proposal.id)
state = hired.state
const milestone = state.milestones.find(item => item.contractId === hired.contractId)!
assert.equal(state.contracts.find(item => item.id === hired.contractId)?.proposalId, proposal.id)
assert.equal(milestone.status, 'Pending Funding')
assert.throws(() => changeMilestone(state, milestone.id, 'approve'), /not available/)
state = changeMilestone(state, milestone.id, 'fund')
assert.throws(() => changeMilestone(state, milestone.id, 'fund'), /not available/)
state = { ...state, role: 'freelancer' }
assert.throws(() => changeMilestone(state, milestone.id, 'submit', 'Too early'), /not available/)
state = changeMilestone(state, milestone.id, 'start')
state = changeMilestone(state, milestone.id, 'submit', 'Responsive storefront and handover are ready for review.')
state = { ...state, role: 'client' }
const disputed = changeMilestone(state, milestone.id, 'dispute', 'The delivered storefront needs a final accessibility review.')
assert.equal(disputed.disputes.find(item => item.milestoneId === milestone.id)?.status, 'Open')
assert.equal(disputed.contracts.find(item => item.id === hired.contractId)?.status, 'Disputed')
assert.throws(() => changeMilestone(disputed, milestone.id, 'approve'), /not available/)
console.log('PASS dispute branch blocks milestone approval')
state = changeMilestone(state, milestone.id, 'approve')
state = changeMilestone(state, milestone.id, 'release')
assert.throws(() => changeMilestone(state, milestone.id, 'release'), /not available/)
assert.equal(state.contracts.find(item => item.id === hired.contractId)?.status, 'Completed')
assert(state.transactions.some(item => item.milestoneId === milestone.id && item.kind === 'Milestone release'))
assert(state.invoices.some(item => item.contractId === hired.contractId))
console.log('PASS posting, proposal, hire, guarded milestone transitions, release, invoice')

state = addReview(state, hired.contractId, 5, 'Strong work and clear communication throughout the full demo project.')
assert.throws(() => addReview(state, hired.contractId, 5, 'A second review should not be allowed for this demo contract.'), /already reviewed/)
state = { ...state, role: 'freelancer' }
const available = getAvailableBalance(state)
assert(available > 0)
assert.throws(() => requestWithdrawal(state, available + rupees(1)), /available demo balance/)
state = requestWithdrawal(state, rupees(1000))
assert.equal(getAvailableBalance(state), available - rupees(1000))
console.log('PASS unique reviews and bounded simulated withdrawals')

saveDemoState(state)
assert.equal(loadDemoState().contracts.find(item => item.id === hired.contractId)?.status, 'Completed')
assert.equal(resetDemoState().jobs.filter(job => job.status === 'Open').length, 12)
console.log('PASS versioned persistence and reset')
