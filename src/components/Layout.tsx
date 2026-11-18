import { Suspense, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, Check, ChevronDown, Menu, X } from 'lucide-react'
import { Button } from './ui/button'
import { useDemo } from '../data/DemoStore'
import { LoadingSkeleton, NotificationDropdown } from './WorkspaceUI'
import type { DemoRole } from '../data/demoModels'

export function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="KaamDhaam home"><span className="brand-mark"><BriefcaseBusiness size={17} strokeWidth={2.35} /></span><span>KaamDhaam</span></Link>
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { state, setRole } = useDemo()
  useEffect(() => setOpen(false), [location.pathname])
  return <header className="site-header"><div className="container nav-inner">
    <Brand />
    <nav className="nav-center" aria-label="Main navigation"><NavLink to="/jobs" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Find Work</NavLink><NavLink to="/talent" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Hire Talent</NavLink><NavLink to="/enterprise" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Enterprise</NavLink></nav>
    <div className="nav-actions">{state.role ? <><span className="nav-demo-pill">DEMO</span><NotificationDropdown/><Link to={`/dashboard/${state.role}`} className="login-link">Dashboard</Link><select aria-label="Switch demo role" className="nav-role-select" value={state.role} onChange={event => { const role = event.target.value as DemoRole; setRole(role); navigate(`/dashboard/${role}`) }}><option value="freelancer">Freelancer</option><option value="client">Client</option><option value="admin">Admin</option></select><button className="nav-logout" onClick={() => { setRole(null); navigate('/') }}>Log out</button></> : <><Link to="/login" className="login-link">Log In</Link><Button asChild size="sm"><Link to="/signup">Sign Up</Link></Button></>}</div>
    <button className="mobile-menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={23} /></button>
  </div>{open && <><div className="drawer-scrim" onClick={() => setOpen(false)} /><div className="mobile-nav-drawer"><div className="mobile-nav-head"><Brand /><button onClick={() => setOpen(false)} aria-label="Close menu"><X size={22}/></button></div><NavLink to="/jobs">Find Work</NavLink><NavLink to="/talent">Hire Talent</NavLink><NavLink to="/enterprise">Enterprise</NavLink>{state.role && <><NavLink to={`/dashboard/${state.role}`}>Dashboard</NavLink><NavLink to="/notifications">Notifications</NavLink></>}<div className="mobile-nav-bottom">{state.role ? <><label className="mobile-role-label">Demo role<select value={state.role} onChange={event => { const role = event.target.value as DemoRole; setRole(role); navigate(`/dashboard/${role}`); setOpen(false) }}><option value="freelancer">Freelancer</option><option value="client">Client</option><option value="admin">Admin</option></select></label><Button variant="outline" onClick={() => { setRole(null); navigate('/'); setOpen(false) }}>Leave demo session</Button></> : <><Link to="/login">Log In</Link><Button asChild><Link to="/signup">Sign Up <ArrowRight size={16}/></Link></Button></>}</div></div></>}</header>
}

export function Footer() { return <footer className="footer"><div className="container"><div className="footer-grid"><div className="footer-about"><Brand light /><p>Bharat ka apna freelance marketplace.</p><span>काम धाम · Kaam bhi, kamaai bhi.</span></div><div><h4>Platform</h4><Link to="/jobs">Find Work</Link><Link to="/talent">Hire Talent</Link><Link to="/signup">Join KaamDhaam</Link></div><div><h4>Explore</h4><Link to="/jobs?category=Web%20Development">Web Development</Link><Link to="/jobs?category=UI%2FUX%20Design">Design</Link><Link to="/jobs?category=Content%20Writing">Writing</Link></div><div><h4>Company</h4><Link to="/enterprise">Enterprise</Link><Link to="/enterprise#how-it-works">How it works</Link><Link to="/enterprise#contact">Contact</Link></div><div><h4>Support</h4><Link to="/support">Help centre</Link><Link to="/support#privacy">Privacy</Link><Link to="/support#terms">Terms</Link></div></div><div className="footer-bottom"><span>© 2026 KaamDhaam. Visual prototype with demo content.</span><span>Made for ambitious work across India <span aria-hidden="true">✳</span></span></div></div></footer> }

export function Toast({ message, onClose }: { message: string; onClose: () => void }) { useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [message, onClose]); return <div className="toast" role="status"><span className="toast-icon"><Check size={15}/></span>{message}<button onClick={onClose} aria-label="Dismiss notification"><X size={15}/></button></div> }

export function SiteLayout() { const location = useLocation(); useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [location.pathname]); return <><Navbar /><main><Suspense fallback={<div className="container page-shell"><LoadingSkeleton rows={4}/></div>}><Outlet /></Suspense></main><Footer /></> }

export function PageHeader({ eyebrow, title, subtitle, aside }: { eyebrow?: string; title: string; subtitle: string; aside?: ReactNode }) { return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{subtitle}</p></div>{aside && <div className="page-heading-aside">{aside}</div>}</div> }

export function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) { return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div> }

export function Breadcrumb({ items }: { items: { label: string; to?: string }[] }) { return <div className="breadcrumb">{items.map((item, i) => <span key={item.label}>{i > 0 && <ChevronDown size={13} className="breadcrumb-chevron" />}{item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}</span>)}</div> }
