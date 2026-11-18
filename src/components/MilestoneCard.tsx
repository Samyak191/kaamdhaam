import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, FileCheck2, Paperclip, ShieldCheck, X } from 'lucide-react'
import type { DemoRole, Milestone } from '../data/demoModels'
import { formatDate, formatINR } from '../data/demoModels'
import { useDemo } from '../data/DemoStore'
import type { MilestoneAction } from '../data/demoService'
import { ConfirmationDialog, StatusBadge } from './WorkspaceUI'
import { Button } from './ui/button'
import { Toast } from './Layout'

const labels: Record<MilestoneAction, string> = { fund: 'Simulate Funding', start: 'Start Work', submit: 'Submit Deliverables', resubmit: 'Resubmit Work', revise: 'Request Revision', approve: 'Approve Submission', release: 'Simulate Release', dispute: 'Raise Dispute' }
function allowed(status: Milestone['status'], role: DemoRole): MilestoneAction[] { if (role === 'freelancer') return status === 'Funded' ? ['start'] : status === 'In Progress' ? ['submit'] : status === 'Revision Requested' ? ['resubmit'] : []; if (role === 'client') return status === 'Pending Funding' ? ['fund'] : status === 'Submitted' ? ['approve', 'revise', 'dispute'] : status === 'Approved' ? ['release', 'dispute'] : ['Funded', 'In Progress', 'Revision Requested'].includes(status) ? ['dispute'] : []; return [] }

export function MilestoneCard({ milestone, role }: { milestone: Milestone; role: DemoRole }) {
  const { state, changeMilestone } = useDemo()
  const [action, setAction] = useState<MilestoneAction | null>(null)
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')
  const contract = state.contracts.find(item => item.id === milestone.contractId)
  const job = state.jobs.find(item => item.id === contract?.jobId)
  const actions = contract?.status === 'Active' ? allowed(milestone.status, role) : []
  const needsNote = action === 'submit' || action === 'resubmit' || action === 'dispute' || action === 'revise'
  function proceed() { if (!action) return; try { changeMilestone(milestone.id, action, note); setToast(`${labels[action]} recorded in demo`); setAction(null); setNote('') } catch (error) { setToast(error instanceof Error ? error.message : 'Action unavailable') } }
  return <article className="milestone-card panel"><div className="milestone-card-top"><div><span className="eyebrow">{job?.title || 'Project milestone'}</span><h3>{milestone.title}</h3></div><StatusBadge status={milestone.status}/></div><p>{milestone.description}</p><div className="milestone-card-facts"><span><strong>{formatINR(milestone.amountPaise)}</strong><small>Milestone amount</small></span><span><CalendarDays size={14}/>{formatDate(milestone.deadline)}</span>{milestone.attachments.length > 0 && <span><Paperclip size={14}/>{milestone.attachments.join(', ')}</span>}</div>{milestone.submission && <div className="milestone-submission"><FileCheck2 size={16}/><p><strong>Submission details</strong><br/>{milestone.submission}</p></div>}<div className="milestone-card-actions">{actions.map(item => <Button key={item} size="sm" variant={item === 'dispute' || item === 'revise' ? 'outline' : 'primary'} onClick={() => setAction(item)}>{labels[item]}</Button>)}{role === 'freelancer' && <Button asChild size="sm" variant="outline"><Link to="/dashboard/freelancer/earnings">View Payment Status <ArrowRight size={14}/></Link></Button>}{role === 'admin' && <Button asChild size="sm" variant="outline"><Link to={`/contracts/${milestone.contractId}`}>View Contract</Link></Button>}</div>{action && (needsNote ? <div className="modal-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setAction(null) }}><div className="proposal-modal milestone-action-modal" role="dialog" aria-modal="true" aria-labelledby="milestone-action-title"><div className="modal-header"><div><span className="eyebrow">DEMO MILESTONE ACTION</span><h2 id="milestone-action-title">{labels[action]}</h2><p>{milestone.title}</p></div><button onClick={() => setAction(null)} aria-label="Close"><X size={20}/></button></div><div className="milestone-action-body"><label>{action === 'dispute' ? 'Reason for dispute' : action === 'revise' ? 'Requested changes' : 'Deliverable notes'}<textarea rows={5} value={note} onChange={event => setNote(event.target.value)} placeholder={action === 'submit' || action === 'resubmit' ? 'Describe what you completed and where the client can review it...' : 'Add a clear note for the other party...'}/></label><p><ShieldCheck size={15}/> This action changes browser-only demo state.</p><div><Button variant="outline" onClick={() => setAction(null)}>Cancel</Button><Button onClick={proceed}>Confirm {labels[action]}</Button></div></div></div></div> : <ConfirmationDialog title={`${labels[action]}?`} text={action === 'fund' || action === 'release' ? 'This is only a simulated payment state change. No money moves.' : 'This updates the milestone in the browser-only demo.'} confirmLabel={labels[action]} onClose={() => setAction(null)} onConfirm={proceed}/>)}{toast && <Toast message={toast} onClose={() => setToast('')}/>}</article>
}

