import { jobs as phaseOneJobs } from './marketplace'
import type { ClientProfile, DemoJob, DemoState, FreelancerProfile, PortfolioItem, Proposal, User } from './demoModels'
import { rupees } from './demoModels'

const at = '2026-11-12T10:00:00.000Z'
const deadline = '2026-12-20T10:00:00.000Z'

type ProfileSpec = [string, string, string, string, string, number, number, number, string[], number, string, number]
const specs: ProfileSpec[] = [
  ['aarav-mehta', 'Aarav Mehta', 'Full Stack Developer', 'Software Development', 'Bengaluru', 1500, 4.9, 42, ['React', 'Node.js', 'TypeScript', 'PostgreSQL'], 7, 'Available now', 1],
  ['priya-shah', 'Priya Shah', 'Brand & UI Designer', 'UI/UX Design', 'Mumbai', 1200, 5.0, 36, ['Figma', 'Branding', 'UI/UX', 'Illustrator'], 6, 'Available now', 0],
  ['kabir-khan', 'Kabir Khan', 'Video Editor & Motion Designer', 'Video Editing', 'Mumbai', 1100, 4.8, 28, ['Premiere Pro', 'After Effects', 'Motion Graphics'], 5, 'Available soon', 3],
  ['neha-iyer', 'Neha Iyer', 'Data Analyst & BI Consultant', 'Data Analytics', 'Chennai', 1350, 4.9, 31, ['Power BI', 'SQL', 'Python', 'Tableau'], 6, 'Available now', 2],
  ['priya-sharma', 'Priya Sharma', 'Product & UI/UX Designer', 'UI/UX Design', 'Pune', 1200, 4.9, 39, ['Figma', 'UX Research', 'Design Systems'], 6, 'Available now', 5],
  ['rohan-gupta', 'Rohan Gupta', 'AI/ML Engineer', 'AI & Machine Learning', 'Gurugram', 2000, 4.9, 24, ['Python', 'FastAPI', 'LLM', 'RAG'], 8, 'Available soon', 6],
  ['ananya-iyer', 'Ananya Iyer', 'Digital Marketing Specialist', 'Digital Marketing', 'Chennai', 900, 4.8, 47, ['SEO', 'Google Analytics', 'Ads'], 5, 'Available now', 7],
  ['siddharth-rao', 'Siddharth Rao', 'Shopify & Ecommerce Developer', 'Web Development', 'Hyderabad', 1400, 4.9, 33, ['Shopify', 'Liquid', 'React', 'SEO'], 7, 'Available now', 4],
  ['meera-nair', 'Meera Nair', 'Content Strategist & Writer', 'Content Writing', 'Kochi', 850, 4.9, 51, ['Hindi Writing', 'SEO', 'Content Strategy'], 8, 'Available now', 8],
  ['arjun-patel', 'Arjun Patel', 'Mobile App Developer', 'Mobile Applications', 'Ahmedabad', 1600, 4.8, 27, ['React Native', 'TypeScript', 'Flutter'], 6, 'Booked', 9],
  ['ishita-verma', 'Ishita Verma', 'Graphic Designer & Illustrator', 'Graphic Design', 'Jaipur', 950, 5.0, 44, ['Illustrator', 'Branding', 'Figma'], 6, 'Available now', 10],
  ['dev-malhotra', 'Dev Malhotra', 'Backend & Cloud Engineer', 'Software Development', 'Delhi', 1750, 4.8, 22, ['Node.js', 'TypeScript', 'PostgreSQL'], 8, 'Available now', 11],
]

const workTitles: Record<string, [string, string]> = {
  'aarav-mehta': ['Merchant operations platform', 'Fintech product dashboard'],
  'priya-shah': ['Mora brand identity', 'Wellness app experience'],
  'kabir-khan': ['Launch film for a consumer brand', 'Social motion campaign'],
  'neha-iyer': ['Retail intelligence dashboard', 'Supply chain reporting'],
  'priya-sharma': ['B2B operations redesign', 'Mobile design system'],
  'rohan-gupta': ['Commerce support assistant', 'Demand forecasting toolkit'],
  'ananya-iyer': ['D2C growth strategy', 'Search-led content programme'],
  'siddharth-rao': ['Skincare storefront', 'Lifestyle commerce refresh'],
  'meera-nair': ['Finance learning guides', 'Editorial content system'],
  'arjun-patel': ['Payments companion app', 'Field service mobile tool'],
  'ishita-verma': ['Learning brand illustrations', 'Packaging identity system'],
  'dev-malhotra': ['Logistics API platform', 'Cloud migration toolkit'],
}

function portfolio(id: string, category: string, skills: string[]): PortfolioItem[] {
  return workTitles[id].map((title, i) => ({ id: `${id}-work-${i + 1}`, title, category, description: i === 0 ? 'A focused collaboration from discovery through polished delivery.' : 'A practical solution built for a growing Indian team.', technologies: skills.slice(0, 3), imageIndex: i }))
}

export const seedProfiles: FreelancerProfile[] = specs.map(([id, name, title, category, city, rate, rating, completedProjects, skills, experienceYears, availability, photoIndex]) => ({
  id, userId: id === 'priya-sharma' ? 'f-priya-sharma' : `f-${id.split('-')[0]}`, name, title, category, city, ratePaise: rupees(rate), rating, completedProjects, skills, experienceYears, availability: availability as FreelancerProfile['availability'], verified: true,
  about: `${name} is a ${title.toLowerCase()} with ${experienceYears} years of experience. They work with Indian founders and teams to turn complex briefs into clear, well-crafted results. Their approach combines practical planning, regular communication, and thoughtful attention to detail.`,
  portfolio: portfolio(id, category, skills), experience: [`Independent ${title} · 2022–present`, `${category} specialist · 2019–2022`], education: 'Bachelor’s degree · Indian university', certifications: [skills[0] + ' professional programme'], photoIndex,
}))

const companyUserId = (jobId: string) => jobId === 'shopify-storefront' ? 'c-nira' : `c-${jobId}`
const phaseJobs: DemoJob[] = phaseOneJobs.map(job => ({ ...job, clientId: companyUserId(job.id), status: 'Open', createdAt: at, budgetMinPaise: rupees(job.budgetMin), budgetMaxPaise: rupees(Math.round(job.budgetMin * 1.55)) }))
const seededExtraJobs: DemoJob[] = [
  { ...phaseOneJobs[0], id: 'demo-active-project', title: 'Customer portal redesign', description: 'A clear, responsive portal for customer accounts.', details: 'A private client portal with dashboard, account, and support flows.', category: 'Web Development', budget: '₹90,000', budgetMin: 90000, skills: ['React', 'TypeScript', 'Figma'], proposals: 1, averageBid: '₹90,000', clientId: 'c-nira', status: 'In Progress', createdAt: '2026-10-20T10:00:00.000Z', budgetMinPaise: rupees(90000), budgetMaxPaise: rupees(90000), deliverables: ['Design review', 'Responsive portal', 'Handover'], timeline: '6 weeks' },
  { ...phaseOneJobs[5], id: 'demo-complete-project', title: 'Sales insights dashboard', description: 'A retail sales dashboard for weekly decisions.', details: 'A completed dashboard with analytics, exports, and training.', category: 'Data Analytics', budget: '₹48,000', budgetMin: 48000, skills: ['React', 'SQL', 'Power BI'], proposals: 1, averageBid: '₹48,000', clientId: 'c-nira', status: 'Completed', createdAt: '2026-09-01T10:00:00.000Z', budgetMinPaise: rupees(48000), budgetMaxPaise: rupees(48000), deliverables: ['KPI dashboard', 'Data model', 'Training'], timeline: '4 weeks' },
]

const clientUsers: User[] = phaseOneJobs.map(job => ({ id: companyUserId(job.id), name: job.client, role: 'client', city: job.clientLocation.split(',')[0], status: 'Active', joinedAt: '2026-06-12T09:00:00.000Z' }))
const uniqueClients = clientUsers.filter((user, i) => clientUsers.findIndex(item => item.id === user.id) === i)
export const seedUsers: User[] = [
  ...seedProfiles.map(profile => ({ id: profile.userId, name: profile.name, role: 'freelancer' as const, city: profile.city, status: 'Active' as const, joinedAt: '2026-05-15T09:00:00.000Z' })),
  ...uniqueClients,
  { id: 'a-admin', name: 'KaamDhaam Admin', role: 'admin', city: 'India', status: 'Active', joinedAt: '2026-01-01T09:00:00.000Z' },
]
export const seedClients: ClientProfile[] = uniqueClients.map(user => ({ id: user.id, userId: user.id, company: user.name, city: user.city, industry: user.id === 'c-nira' ? 'Beauty & wellness' : 'Professional services', verified: true }))

const seedProposals: Proposal[] = [
  { id: 'proposal-siddharth-shopify', jobId: 'shopify-storefront', freelancerId: 'f-siddharth', clientId: 'c-nira', bidPaise: rupees(58000), delivery: '4 weeks', coverLetter: 'I have built conversion-focused Shopify stores for Indian D2C brands. I would start with the product journey, then implement responsive templates and a thorough handover.', milestonePlan: [{ title: 'Storefront build', amountPaise: rupees(40000) }, { title: 'Testing and handover', amountPaise: rupees(18000) }], status: 'Shortlisted', createdAt: '2026-11-17T11:00:00.000Z' },
  { id: 'proposal-dev-shopify', jobId: 'shopify-storefront', freelancerId: 'f-dev', clientId: 'c-nira', bidPaise: rupees(69000), delivery: '6 weeks', coverLetter: 'I can support the frontend implementation and integration needs for your new store. My proposal includes responsive development, testing, and documentation.', milestonePlan: [{ title: 'Implementation', amountPaise: rupees(69000) }], status: 'Pending', createdAt: '2026-11-18T08:30:00.000Z' },
  { id: 'proposal-active', jobId: 'demo-active-project', freelancerId: 'f-aarav', clientId: 'c-nira', bidPaise: rupees(90000), delivery: '6 weeks', coverLetter: 'I will deliver the responsive portal in clear stages, with a design review and build checkpoints.', milestonePlan: [{ title: 'Discovery and design', amountPaise: rupees(25000) }, { title: 'Portal implementation', amountPaise: rupees(45000) }, { title: 'Final handover', amountPaise: rupees(20000) }], status: 'Accepted', createdAt: '2026-10-19T09:00:00.000Z' },
  { id: 'proposal-complete', jobId: 'demo-complete-project', freelancerId: 'f-aarav', clientId: 'c-nira', bidPaise: rupees(48000), delivery: '4 weeks', coverLetter: 'I will build a clear sales analytics dashboard with exports and a team walkthrough.', milestonePlan: [{ title: 'Dashboard delivery', amountPaise: rupees(48000) }], status: 'Accepted', createdAt: '2026-08-29T09:00:00.000Z' },
]

export function createSeedState(): DemoState {
  return {
    version: 2, role: null, users: seedUsers, profiles: seedProfiles, clients: seedClients, jobs: [...phaseJobs, ...seededExtraJobs], proposals: seedProposals,
    contracts: [
      { id: 'contract-active', jobId: 'demo-active-project', proposalId: 'proposal-active', clientId: 'c-nira', freelancerId: 'f-aarav', valuePaise: rupees(90000), status: 'Active', startAt: '2026-10-21T09:00:00.000Z', deadline, description: 'Customer portal redesign and implementation.', deliverables: ['Design review', 'Responsive portal', 'Handover'] },
      { id: 'contract-complete', jobId: 'demo-complete-project', proposalId: 'proposal-complete', clientId: 'c-nira', freelancerId: 'f-aarav', valuePaise: rupees(48000), status: 'Completed', startAt: '2026-09-02T09:00:00.000Z', deadline: '2026-10-02T09:00:00.000Z', description: 'Retail sales insights dashboard.', deliverables: ['KPI dashboard', 'Data model', 'Training'] },
    ],
    milestones: [
      { id: 'milestone-active-1', contractId: 'contract-active', title: 'Discovery and design', description: 'Review the portal flows and approve visual direction.', amountPaise: rupees(25000), deadline: '2026-11-05T09:00:00.000Z', status: 'Released', submission: 'Design files and flow notes shared.', attachments: ['portal-flows.pdf'] },
      { id: 'milestone-active-2', contractId: 'contract-active', title: 'Portal implementation', description: 'Build responsive dashboard and account flows.', amountPaise: rupees(45000), deadline: '2026-11-25T09:00:00.000Z', status: 'Submitted', submission: 'Responsive portal build is ready for review.', attachments: ['portal-preview.zip'] },
      { id: 'milestone-active-3', contractId: 'contract-active', title: 'Final handover', description: 'Testing, fixes, documentation, and team handover.', amountPaise: rupees(20000), deadline, status: 'Pending Funding', attachments: [] },
      { id: 'milestone-complete', contractId: 'contract-complete', title: 'Dashboard delivery', description: 'Final dashboard and training.', amountPaise: rupees(48000), deadline: '2026-10-02T09:00:00.000Z', status: 'Released', submission: 'Dashboard and handover completed.', attachments: ['sales-dashboard.pdf'] },
    ],
    conversations: [{ id: 'conversation-active', participants: ['c-nira', 'f-aarav'], contractId: 'contract-active', jobId: 'demo-active-project', lastReadAt: { 'c-nira': '2026-11-17T11:00:00.000Z', 'f-aarav': '2026-11-17T11:00:00.000Z' } }],
    messages: [
      { id: 'message-seed-1', conversationId: 'conversation-active', senderId: 'c-nira', body: 'Hi Aarav, the portal screens look good. Could you share the mobile view too?', at: '2026-11-17T10:30:00.000Z' },
      { id: 'message-seed-2', conversationId: 'conversation-active', senderId: 'f-aarav', body: 'Absolutely. I have uploaded the responsive preview and a short walkthrough.', at: '2026-11-17T11:00:00.000Z', attachment: 'portal-mobile-preview.pdf' },
    ],
    notifications: [
      { id: 'notification-seed-1', userId: 'c-nira', kind: 'proposal', title: 'New proposal received', body: 'Siddharth Rao sent a proposal for the Shopify storefront.', href: '/dashboard/client/proposals', read: false, at: '2026-11-17T09:00:00.000Z' },
      { id: 'notification-seed-2', userId: 'f-aarav', kind: 'milestone', title: 'Milestone awaiting review', body: 'Portal implementation was submitted for review.', href: '/dashboard/freelancer/milestones', read: false, at: '2026-11-18T08:00:00.000Z' },
    ],
    reviews: [{ id: 'review-seed', contractId: 'contract-complete', reviewerId: 'c-nira', revieweeId: 'f-aarav', rating: 5, text: 'Thoughtful work, clear updates, and a dashboard our team can use every week.', at: '2026-10-03T09:00:00.000Z' }],
    transactions: [
      { id: 'transaction-active-1', contractId: 'contract-active', milestoneId: 'milestone-active-1', userId: 'f-aarav', kind: 'Milestone release', amountPaise: rupees(25000), status: 'Simulated', at: '2026-11-06T09:00:00.000Z' },
      { id: 'transaction-complete', contractId: 'contract-complete', milestoneId: 'milestone-complete', userId: 'f-aarav', kind: 'Milestone release', amountPaise: rupees(48000), status: 'Simulated', at: '2026-10-02T09:00:00.000Z' },
    ],
    invoices: [
      { id: 'invoice-active-1', transactionId: 'transaction-active-1', contractId: 'contract-active', number: 'KD-DEMO-2026-001', issuedAt: '2026-11-06T09:00:00.000Z', subtotalPaise: rupees(25000), taxPaise: rupees(0), totalPaise: rupees(25000) },
      { id: 'invoice-complete', transactionId: 'transaction-complete', contractId: 'contract-complete', number: 'KD-DEMO-2026-002', issuedAt: '2026-10-02T09:00:00.000Z', subtotalPaise: rupees(48000), taxPaise: rupees(0), totalPaise: rupees(48000) },
    ],
    disputes: [],
    kycRequests: [
      { id: 'kyc-1', userId: 'f-priya', reference: 'DEMO-VERIFY-1042', status: 'Pending', submittedAt: '2026-11-16T09:00:00.000Z' },
      { id: 'kyc-2', userId: 'f-rohan', reference: 'DEMO-VERIFY-1043', status: 'Pending', submittedAt: '2026-11-17T09:00:00.000Z' },
      { id: 'kyc-3', userId: 'c-nira', reference: 'DEMO-VERIFY-0981', status: 'Approved', submittedAt: '2026-09-04T09:00:00.000Z' },
    ],
    settings: {}, savedJobs: [], savedProfiles: [],
  }
}
