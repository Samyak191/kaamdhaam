import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Check, ChevronDown, ListFilter, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react'
import { categories } from '../data/marketplace'
import { useDemo } from '../data/DemoStore'
import { JobCard } from '../components/JobCard'
import { PageHeader, Toast } from '../components/Layout'
import { useSavedJobs } from '../components/useSavedJobs'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

export function JobsPage() {
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') || '')
  const [category, setCategory] = useState(params.get('category') || '')
  const [budget, setBudget] = useState(100000)
  const [type, setType] = useState('All types')
  const [location, setLocation] = useState('Any location')
  const [experience, setExperience] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [sort, setSort] = useState('Newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [toast, setToast] = useState('')
  const { state } = useDemo()
  const openJobs = useMemo(() => state.jobs.filter(job => job.status === 'Open'), [state.jobs])
  const allSkills = useMemo(() => Array.from(new Set(openJobs.flatMap(job => job.skills))).sort(), [openJobs])
  const { savedIds, toggleSaved } = useSavedJobs()
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = openJobs.filter(job => {
      const matchesText = !needle || [job.title, job.description, job.category, job.client, ...job.skills].join(' ').toLowerCase().includes(needle)
      return matchesText && (!category || job.category === category) && job.budgetMin <= budget && (type === 'All types' || job.type === type) && (location === 'Any location' || (location === 'Remote only' ? job.remote : !job.remote)) && (!experience.length || experience.includes(job.experience)) && (!skills.length || skills.some(skill => job.skills.includes(skill)))
    })
    return filtered.sort((a, b) => sort === 'Budget: high to low' ? b.budgetMin - a.budgetMin : sort === 'Budget: low to high' ? a.budgetMin - b.budgetMin : sort === 'Relevance' && needle ? ([b.title, ...b.skills].join(' ').toLowerCase().includes(needle) ? 1 : 0) - ([a.title, ...a.skills].join(' ').toLowerCase().includes(needle) ? 1 : 0) : a.daysAgo - b.daysAgo)
  }, [query, category, budget, type, location, experience, skills, sort, openJobs])
  function toggleSelection(value: string, current: string[], set: (value: string[]) => void) { set(current.includes(value) ? current.filter(x => x !== value) : [...current, value]) }
  function clear() { setQuery(''); setCategory(''); setBudget(100000); setType('All types'); setLocation('Any location'); setExperience([]); setSkills([]); setSkillSearch(''); setParams({}) }
  const activeCount = (query ? 1 : 0) + (category ? 1 : 0) + (budget < 100000 ? 1 : 0) + (type !== 'All types' ? 1 : 0) + (location !== 'Any location' ? 1 : 0) + experience.length + skills.length
  return <div className="page-shell"><div className="container"><PageHeader title="Browse jobs" subtitle="Find your next opportunity across India." aside={<span className="opportunity-count"><span/> {results.length} opportunities available</span>}/><div className="browse-toolbar-mobile"><Button variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16}/> Filters {activeCount > 0 && <span className="filter-count">{activeCount}</span>}</Button><span>{results.length} results</span></div><div className="browse-layout"><aside className={`filter-panel ${filtersOpen ? 'filter-open' : ''}`}><div className="filter-mobile-head"><strong>Filters</strong><button onClick={() => setFiltersOpen(false)} aria-label="Close filters"><X size={20}/></button></div><div className="filter-title"><span><ListFilter size={17}/> Filters</span><button onClick={clear}>Clear all</button></div><div className="filter-section"><h3>SEARCH</h3><div className="filter-search"><Search size={16}/><Input placeholder="Search jobs..." aria-label="Search jobs" value={query} onChange={e => setQuery(e.target.value)}/></div></div><div className="filter-section"><h3>BUDGET</h3><input type="range" className="range-input" min="10000" max="100000" step="5000" value={budget} onChange={e => setBudget(Number(e.target.value))} aria-label="Maximum budget"/><div className="range-labels"><span>â‚¹10,000</span><span>â‚¹{budget.toLocaleString('en-IN')}{budget === 100000 ? '+' : ''}</span></div></div><div className="filter-section"><h3>JOB TYPE</h3>{['All types', 'Fixed price', 'Hourly'].map(item => <label className="filter-option" key={item}><input type="radio" checked={type === item} onChange={() => setType(item)}/><span>{item}</span></label>)}</div><div className="filter-section"><h3>LOCATION</h3>{['Any location', 'Remote only', 'On-site / city based'].map(item => <label className="filter-option" key={item}><input type="radio" checked={location === item} onChange={() => setLocation(item)}/><span>{item}</span></label>)}</div><div className="filter-section"><h3>CATEGORY</h3><div className="filter-options-scroll">{categories.map(item => <label className="filter-option" key={item}><input type="checkbox" checked={category === item} onChange={() => { const next = category === item ? '' : item; setCategory(next); setParams(previous => { const p = new URLSearchParams(previous); if (next) p.set('category', next); else p.delete('category'); return p }) }}/><span>{item}</span></label>)}</div></div><div className="filter-section"><h3>EXPERIENCE LEVEL</h3>{['Beginner', 'Intermediate', 'Expert'].map(item => <label className="filter-option" key={item}><input type="checkbox" checked={experience.includes(item)} onChange={() => toggleSelection(item, experience, setExperience)}/><span>{item}</span></label>)}</div><div className="filter-section"><h3>SKILLS</h3><div className="filter-search"><Search size={15}/><Input placeholder="Search skills" value={skillSearch} onChange={e => setSkillSearch(e.target.value)} aria-label="Search skills"/></div><div className="filter-skill-list">{allSkills.filter(item => item.toLowerCase().includes(skillSearch.toLowerCase())).slice(0, 8).map(item => <button key={item} className={skills.includes(item) ? 'selected' : ''} onClick={() => toggleSelection(item, skills, setSkills)}>{skills.includes(item) && <Check size={12}/>} {item}</button>)}</div></div><div className="filter-apply-mobile"><Button onClick={() => setFiltersOpen(false)}>Show {results.length} results</Button></div></aside><div className="listing-column"><div className="listing-toolbar"><div><strong>{results.length} jobs found</strong><span>{activeCount ? `${activeCount} active filter${activeCount > 1 ? 's' : ''}` : 'Explore opportunities matched to your skills'}</span></div><label>Sort by <span className="select-wrap"><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort jobs"><option>Newest</option><option>Budget: high to low</option><option>Budget: low to high</option><option>Relevance</option></select><ChevronDown size={14}/></span></label></div>{results.length > 0 ? <div className="job-list">{results.map(job => <JobCard key={job.id} job={job} saved={savedIds.includes(job.id)} onSave={id => { toggleSaved(id); setToast(savedIds.includes(id) ? 'Removed from saved jobs' : 'Job saved for later') }}/>)}</div> : <div className="empty-state"><div><Search size={24}/></div><h3>No jobs match those filters</h3><p>Try a different search or clear a few filters to see more opportunities.</p><Button variant="outline" onClick={clear}><RotateCcw size={16}/> Clear filters</Button></div>}<div className="listing-bottom"><span>Showing {results.length} of {openJobs.length} demo opportunities</span><Link to="/talent">Looking to hire? Explore talent <ArrowUpRight size={15}/></Link></div></div></div></div>{filtersOpen && <div className="filter-scrim" onClick={() => setFiltersOpen(false)}/>}{toast && <Toast message={toast} onClose={() => setToast('')}/>}</div>
}
