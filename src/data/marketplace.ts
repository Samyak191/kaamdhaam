export type JobType = 'Fixed price' | 'Hourly'
export type Experience = 'Beginner' | 'Intermediate' | 'Expert'

export interface Job {
  id: string
  title: string
  category: string
  description: string
  details: string
  skills: string[]
  budget: string
  budgetMin: number
  type: JobType
  location: string
  remote: boolean
  posted: string
  daysAgo: number
  proposals: number
  averageBid: string
  experience: Experience
  timeline: string
  client: string
  clientLocation: string
  deliverables: string[]
}

export const categories = [
  'Software Development', 'Web Development', 'Mobile Applications',
  'AI & Machine Learning', 'UI/UX Design', 'Graphic Design',
  'Digital Marketing', 'Content Writing', 'Video Editing',
  'Data Analytics', 'Business Consulting', 'Other Services',
]

export const jobs: Job[] = [
  { id: 'shopify-storefront', title: 'Build a Shopify storefront for D2C skincare brand', category: 'Web Development', description: 'We are looking for an experienced Shopify developer to build a fast, elegant storefront for our growing skincare brand.', details: 'We are an Indian D2C skincare company preparing a new online store. We need a developer who can translate our visual direction into a responsive, conversion-focused Shopify storefront. The finished site should be easy for our team to maintain.', skills: ['Shopify', 'Liquid', 'Razorpay', 'React'], budget: '₹45,000–₹75,000', budgetMin: 45000, type: 'Fixed price', location: 'Mumbai, India', remote: true, posted: '2 hours ago', daysAgo: 0, proposals: 18, averageBid: '₹58,400', experience: 'Intermediate', timeline: '4–6 weeks', client: 'Nira Skincare', clientLocation: 'Mumbai, Maharashtra', deliverables: ['Responsive storefront with homepage, collection and product pages', 'Theme customization and basic integrations', 'Performance and mobile usability pass', 'Handover documentation for the internal team'] },
  { id: 'react-native-fintech', title: 'React Native developer for fintech mobile app', category: 'Mobile Applications', description: 'Help our product team build a polished cross-platform app for everyday money management.', details: 'We have approved designs and a working product roadmap. We are looking for a React Native developer to implement core screens, connect mocked service interfaces, and collaborate closely with our design lead.', skills: ['React Native', 'TypeScript', 'UPI', 'Razorpay'], budget: '₹1,200–₹2,000/hr', budgetMin: 1200, type: 'Hourly', location: 'Remote', remote: true, posted: '5 hours ago', daysAgo: 0, proposals: 26, averageBid: '₹1,650/hr', experience: 'Expert', timeline: '2–3 months', client: 'Sutra Fintech', clientLocation: 'Bengaluru, Karnataka', deliverables: ['Cross-platform feature screens', 'Reusable component library', 'QA fixes and handoff notes'] },
  { id: 'edtech-brand', title: 'Logo + brand identity for ed-tech startup', category: 'Graphic Design', description: 'Create a thoughtful visual identity for a learning platform serving students across India.', details: 'Our team is launching an accessible learning product. We need a designer who can explore brand directions, refine the selected concept, and package a practical identity system.', skills: ['Branding', 'Figma', 'Illustrator'], budget: '₹25,000–₹40,000', budgetMin: 25000, type: 'Fixed price', location: 'Pune, India', remote: true, posted: '1 day ago', daysAgo: 1, proposals: 34, averageBid: '₹32,000', experience: 'Intermediate', timeline: '3 weeks', client: 'VidyaLoop', clientLocation: 'Pune, Maharashtra', deliverables: ['Logo variations', 'Color and type system', 'Social media templates', 'Mini brand guidelines'] },
  { id: 'ecommerce-chatbot', title: 'AI chatbot for an Indian e-commerce business', category: 'AI & Machine Learning', description: 'Build a helpful support assistant that can answer product and order questions in English and Hindi.', details: 'We want a proof of concept for an AI support assistant. It should use our sample FAQ and catalog data, provide grounded answers, and show clear fallback behavior.', skills: ['Python', 'FastAPI', 'LLM', 'RAG'], budget: '₹55,000–₹90,000', budgetMin: 55000, type: 'Fixed price', location: 'Remote', remote: true, posted: '1 day ago', daysAgo: 1, proposals: 21, averageBid: '₹72,500', experience: 'Expert', timeline: '5 weeks', client: 'Bazaarly', clientLocation: 'Delhi, India', deliverables: ['Working chatbot prototype', 'Knowledge retrieval pipeline', 'Evaluation notes', 'Setup documentation'] },
  { id: 'real-estate-wordpress', title: 'WordPress website for a real estate company', category: 'Web Development', description: 'Design and develop a clean property website with lead forms and searchable listings.', details: 'We need a modern WordPress site to present residential properties and collect qualified inquiries. The site should be responsive and straightforward for our marketing team to update.', skills: ['WordPress', 'Elementor', 'SEO'], budget: '₹20,000–₹35,000', budgetMin: 20000, type: 'Fixed price', location: 'Hyderabad, India', remote: false, posted: '2 days ago', daysAgo: 2, proposals: 42, averageBid: '₹27,600', experience: 'Intermediate', timeline: '4 weeks', client: 'Habitat Homes', clientLocation: 'Hyderabad, Telangana', deliverables: ['Responsive website', 'Property listing templates', 'Lead capture forms', 'Basic on-page SEO'] },
  { id: 'retail-dashboard', title: 'Data analytics dashboard for retail chain', category: 'Data Analytics', description: 'Turn multi-store sales data into a clear dashboard for daily decisions.', details: 'Our retail operations team needs a dashboard to monitor revenue, product performance, and store comparisons from supplied CSV files.', skills: ['Python', 'Power BI', 'SQL'], budget: '₹40,000–₹65,000', budgetMin: 40000, type: 'Fixed price', location: 'Chennai, India', remote: true, posted: '2 days ago', daysAgo: 2, proposals: 17, averageBid: '₹51,800', experience: 'Intermediate', timeline: '4–5 weeks', client: 'OneShelf Retail', clientLocation: 'Chennai, Tamil Nadu', deliverables: ['Data model and cleanup', 'Interactive Power BI report', 'KPI definitions', 'Walkthrough session'] },
  { id: 'saas-design', title: 'UI/UX designer for a B2B SaaS product', category: 'UI/UX Design', description: 'Simplify a complex operations workflow into an intuitive web app experience.', details: 'We have research notes and existing screens. We need a designer to map key flows, create high-fidelity screens, and prepare a handoff-ready Figma file.', skills: ['Figma', 'UX Research', 'Design Systems'], budget: '₹60,000–₹95,000', budgetMin: 60000, type: 'Fixed price', location: 'Bengaluru, India', remote: true, posted: '3 days ago', daysAgo: 3, proposals: 29, averageBid: '₹76,200', experience: 'Expert', timeline: '6 weeks', client: 'OrbitOps', clientLocation: 'Bengaluru, Karnataka', deliverables: ['User flows', 'High-fidelity screen designs', 'Component library', 'Developer handoff'] },
  { id: 'hindi-content', title: 'Hindi content writer for personal finance guides', category: 'Content Writing', description: 'Write approachable, well-researched money guides for first-time investors.', details: 'We are building a library of useful Hindi articles on saving, budgeting, and investing. The writing must be clear, original, and accessible to new readers.', skills: ['Hindi Writing', 'SEO', 'Finance'], budget: '₹1,500–₹2,500/hr', budgetMin: 1500, type: 'Hourly', location: 'Remote', remote: true, posted: '3 days ago', daysAgo: 3, proposals: 13, averageBid: '₹1,950/hr', experience: 'Intermediate', timeline: 'Ongoing', client: 'PaisaPath', clientLocation: 'Jaipur, Rajasthan', deliverables: ['Four long-form guides per month', 'Source links and fact checks', 'SEO titles and descriptions'] },
  { id: 'product-video', title: 'Edit launch videos for a consumer tech brand', category: 'Video Editing', description: 'Create short product stories for social and paid campaigns from existing footage.', details: 'We will provide footage, a script, and brand assets. We need crisp, engaging edits in multiple aspect ratios and a reliable feedback process.', skills: ['Premiere Pro', 'After Effects', 'Motion Graphics'], budget: '₹30,000–₹50,000', budgetMin: 30000, type: 'Fixed price', location: 'Remote', remote: true, posted: '4 days ago', daysAgo: 4, proposals: 31, averageBid: '₹39,500', experience: 'Intermediate', timeline: '3 weeks', client: 'Nova Devices', clientLocation: 'Noida, Uttar Pradesh', deliverables: ['Three launch films', 'Vertical social cutdowns', 'Captioned exports'] },
  { id: 'seo-growth', title: 'SEO specialist for a sustainable fashion store', category: 'Digital Marketing', description: 'Improve organic discovery through a practical content and technical SEO plan.', details: 'Our ecommerce store is growing and we need a specialist to audit current search performance, identify opportunities, and implement priority fixes.', skills: ['SEO', 'Google Analytics', 'Content Strategy'], budget: '₹35,000–₹55,000', budgetMin: 35000, type: 'Fixed price', location: 'Remote', remote: true, posted: '5 days ago', daysAgo: 5, proposals: 24, averageBid: '₹43,100', experience: 'Intermediate', timeline: '6 weeks', client: 'Thread & Earth', clientLocation: 'Ahmedabad, Gujarat', deliverables: ['Technical SEO audit', 'Keyword and content plan', 'Priority fixes', 'Performance report'] },
  { id: 'backend-api', title: 'Node.js API developer for logistics platform', category: 'Software Development', description: 'Build reliable APIs for shipment tracking and internal operations.', details: 'We are expanding our logistics platform and need a developer who can ship well-documented APIs, tests, and practical monitoring for new workflows.', skills: ['Node.js', 'PostgreSQL', 'TypeScript'], budget: '₹80,000–₹1,20,000', budgetMin: 80000, type: 'Fixed price', location: 'Gurugram, India', remote: false, posted: '6 days ago', daysAgo: 6, proposals: 16, averageBid: '₹97,000', experience: 'Expert', timeline: '8 weeks', client: 'RouteSet', clientLocation: 'Gurugram, Haryana', deliverables: ['Shipment tracking endpoints', 'API documentation', 'Automated tests', 'Deployment handoff'] },
  { id: 'business-research', title: 'Market research for regional food expansion', category: 'Business Consulting', description: 'Research consumer demand and channel opportunities across three Indian cities.', details: 'We need a concise, actionable market view before expanding our packaged food line. The work includes desk research and recommendations.', skills: ['Market Research', 'Strategy', 'Excel'], budget: '₹45,000–₹70,000', budgetMin: 45000, type: 'Fixed price', location: 'Remote', remote: true, posted: '1 week ago', daysAgo: 7, proposals: 11, averageBid: '₹56,000', experience: 'Expert', timeline: '4 weeks', client: 'Masala House', clientLocation: 'Kochi, Kerala', deliverables: ['Market sizing', 'Competitor landscape', 'Channel recommendations', 'Presentation deck'] },
]

export interface Freelancer {
  id: string
  name: string
  title: string
  location: string
  rate: string
  rating: string
  projects: number
  skills: string[]
  color: string
  initials: string
}

export const freelancers: Freelancer[] = [
  { id: 'aarav-mehta', name: 'Aarav Mehta', title: 'Full Stack Developer', location: 'Bengaluru, India', rate: '₹1,500/hr', rating: '4.9', projects: 42, skills: ['React', 'Node.js', 'TypeScript'], color: '#DDEFE7', initials: 'AM' },
  { id: 'priya-shah', name: 'Priya Shah', title: 'Brand & UI Designer', location: 'Mumbai, India', rate: '₹1,200/hr', rating: '5.0', projects: 36, skills: ['Figma', 'Branding', 'UI/UX'], color: '#F5E9DC', initials: 'PS' },
  { id: 'kabir-khan', name: 'Kabir Khan', title: 'Video Editor & Motion Designer', location: 'Mumbai, India', rate: '₹1,100/hr', rating: '4.8', projects: 28, skills: ['Premiere Pro', 'After Effects', 'Motion Graphics'], color: '#E6ECF5', initials: 'KK' },
  { id: 'neha-iyer', name: 'Neha Iyer', title: 'Data Analyst & BI Consultant', location: 'Chennai, India', rate: '₹1,350/hr', rating: '4.9', projects: 31, skills: ['Power BI', 'SQL', 'Python'], color: '#F0E9F3', initials: 'NI' },
]

export const allSkills = Array.from(new Set(jobs.flatMap(job => job.skills))).sort()
