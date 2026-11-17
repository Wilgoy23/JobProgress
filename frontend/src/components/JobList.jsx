import { CLOSED, STATUSES } from '../lib/constants.js';
import { fmtDate, normalizeUrl, portalName, relDays, todayStr } from '../lib/format.js';
import { EditIcon, TrashIcon } from './Icons.jsx';

function JobRow({ job, onEdit, onDelete, onStatusChange }) {
  const today = todayStr();
  const meta = [job.location, job.salary].filter(Boolean).join(' · ');
  const isOpen = !CLOSED.has(job.status) && job.status !== 'offer';
  const due = Boolean(job.follow_up) && isOpen && job.follow_up <= today;
  const href = normalizeUrl(job.url);
  const name = job.company || job.role;

  return (
    <div className="row" role="listitem">
      <div className="cell cell-job">
        <button type="button" className="job-title" onClick={() => onEdit(job)}>{job.company}</button>
        <div className="role">{job.role}</div>
        {meta && <div className="meta">{meta}</div>}
        {job.notes && <div className="notes" title={job.notes}>{job.notes}</div>}
      </div>

      <div className="cell cell-status">
        <select
          className="status-select"
          data-status={job.status}
          value={job.status}
          aria-label={`Status for ${name}`}
          onChange={(e) => onStatusChange(job, e.target.value)}
        >
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </div>

      <div className="cell cell-applied">
        <span className="cell-label">Applied</span>
        {job.date_applied ? (
          <>
            {fmtDate(job.date_applied)}
            <span className="sub">{relDays(job.date_applied)}</span>
          </>
        ) : <span className="dim">—</span>}
      </div>

      <div className="cell cell-follow">
        <span className="cell-label">Follow up</span>
        {job.follow_up ? (
          <>
            <span className={due ? 'due' : undefined}>{fmtDate(job.follow_up)}</span>
            <span className="sub">{due && 'due '}{relDays(job.follow_up)}</span>
          </>
        ) : <span className="dim">—</span>}
      </div>

      <div className="cell cell-link">
        {href ? (
          <a className="portal-link" href={href} target="_blank" rel="noopener noreferrer" title={href}>
            {portalName(href)} <span aria-hidden="true">↗</span>
          </a>
        ) : <span className="dim">No link</span>}
      </div>

      <div className="cell cell-actions">
        <button type="button" className="icon-btn" aria-label={`Edit ${name}`} title="Edit" onClick={() => onEdit(job)}>
          <EditIcon />
        </button>
        <button type="button" className="icon-btn danger" aria-label={`Delete ${name}`} title="Delete" onClick={() => onDelete(job)}>
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

export default function JobList({ jobs, ...handlers }) {
  return (
    <>
      <div className="list-header" aria-hidden="true">
        <span>Company / Role</span>
        <span>Status</span>
        <span>Applied</span>
        <span>Follow up</span>
        <span>Job site</span>
        <span />
      </div>
      <section className="list" role="list">
        {jobs.map((job) => <JobRow key={job.id} job={job} {...handlers} />)}
      </section>
    </>
  );
}
