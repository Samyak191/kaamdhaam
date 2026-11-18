import { ArrowUpRight, Bookmark, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Job } from '../data/marketplace'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

export function JobCard({ job, saved, onSave }: { job: Job; saved: boolean; onSave: (id: string) => void }) {
  return <article className="job-card"><div className="job-main"><div className="job-topline"><Badge className="category-badge">{job.category}</Badge><span>{job.posted}</span><span className="job-dot">·</span><span className="job-location"><MapPin size={13}/>{job.location}</span></div><Link to={`/jobs/${job.id}`} className="job-title-link"><h3>{job.title}</h3></Link><p className="job-description">{job.description}</p><div className="skill-row">{job.skills.map(skill => <span className="skill-tag" key={skill}>{skill}</span>)}</div><div className="job-meta-mobile"><span>{job.proposals} proposals</span><span>Avg. bid {job.averageBid}</span></div></div><div className="job-side"><button className={`save-button ${saved ? 'saved' : ''}`} onClick={() => onSave(job.id)} aria-label={saved ? 'Remove saved job' : 'Save job'} title={saved ? 'Remove saved job' : 'Save job'}><Bookmark size={18} fill={saved ? 'currentColor' : 'none'} /></button><strong>{job.budget}</strong><span className="job-type">{job.type === 'Fixed price' ? 'Fixed budget' : 'Hourly rate'}</span><div className="job-proposals"><span>{job.proposals} proposals</span><span>Avg. bid {job.averageBid}</span></div><Button asChild size="sm"><Link to={`/jobs/${job.id}?apply=1`}>Bid Now <ArrowUpRight size={15}/></Link></Button></div></article>
}
