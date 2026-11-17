import { useEffect, useRef, useState } from 'react';
import { STATUS_LABEL, STATUSES } from '../lib/constants.js';
import { fmtTimestamp, normalizeUrl, portalName, todayStr } from '../lib/format.js';
import { CloseIcon } from './Icons.jsx';

function toForm(job) {
  return {
    company: job?.company ?? '',
    role: job?.role ?? '',
    url: job?.url ?? '',
    status: job?.status ?? 'applied',
    date_applied: job ? job.date_applied ?? '' : todayStr(),
    follow_up: job?.follow_up ?? '',
    location: job?.location ?? '',
    salary: job?.salary ?? '',
    notes: job?.notes ?? '',
  };
}

/** Add/edit modal. `job` is null when adding. Mount it to open, unmount to close. */
export default function JobDialog({ job, onClose, onSave, onDelete }) {
  const dialogRef = useRef(null);
  const pressStartedOnBackdrop = useRef(false);
  const [form, setForm] = useState(() => toForm(job));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog.open) dialog.showModal();
    dialog.querySelector('input[name="company"]').focus();
    return () => dialog.open && dialog.close();
  }, []);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const urlTrimmed = form.url.trim();
  const normalizedUrl = normalizeUrl(urlTrimmed);
  const urlHint = !urlTrimmed ? '' : normalizedUrl ? `Job site: ${portalName(normalizedUrl)}` : 'That doesn’t look like a valid link.';

  async function handleSubmit(e) {
    e.preventDefault();
    if (urlTrimmed && !normalizedUrl) {
      setError('Enter a valid web link for the job (e.g. https://…).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        company: form.company.trim(),
        role: form.role.trim(),
        url: normalizedUrl,
        date_applied: form.date_applied || null,
        follow_up: form.follow_up || null,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="dialog-title"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      // Close on backdrop click, but not when a text selection drag ends outside the form.
      onMouseDown={(e) => { pressStartedOnBackdrop.current = e.target === dialogRef.current; }}
      onClick={(e) => { if (pressStartedOnBackdrop.current && e.target === dialogRef.current) onClose(); }}
    >
      <form onSubmit={handleSubmit}>
        <div className="dialog-head">
          <h2 id="dialog-title">{job ? 'Edit application' : 'Add application'}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><CloseIcon /></button>
        </div>

        <div className="form-grid">
          <label className="field">
            <span>Company <em>*</em></span>
            <input name="company" required maxLength={200} autoComplete="off" value={form.company} onChange={set('company')} />
          </label>
          <label className="field">
            <span>Role <em>*</em></span>
            <input name="role" required maxLength={200} autoComplete="off" value={form.role} onChange={set('role')} />
          </label>
          <label className="field span-2">
            <span>Job link</span>
            <input
              name="url" type="text" inputMode="url" autoComplete="off"
              placeholder="https://company.wd5.myworkdayjobs.com/…"
              value={form.url} onChange={set('url')}
            />
            <small className="hint">{urlHint}</small>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" value={form.status} onChange={set('status')}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Date applied</span>
            <input name="date_applied" type="date" value={form.date_applied} onChange={set('date_applied')} />
          </label>
          <label className="field">
            <span>Location</span>
            <input name="location" maxLength={200} placeholder="Remote, NYC, …" autoComplete="off" value={form.location} onChange={set('location')} />
          </label>
          <label className="field">
            <span>Salary / range</span>
            <input name="salary" maxLength={100} placeholder="$90k–110k" autoComplete="off" value={form.salary} onChange={set('salary')} />
          </label>
          <label className="field">
            <span>Follow up on</span>
            <input name="follow_up" type="date" value={form.follow_up} onChange={set('follow_up')} />
          </label>
          <label className="field span-2">
            <span>Notes</span>
            <textarea
              name="notes" rows={3} maxLength={5000}
              placeholder="Recruiter name, referral, interview prep…"
              value={form.notes} onChange={set('notes')}
            />
          </label>
        </div>

        {job && job.history.length > 0 && (
          <div className="history">
            <h3>Status history</h3>
            <ol>
              {[...job.history].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`}>
                  <span className="pill" data-status={h.status}>{STATUS_LABEL[h.status]}</span>
                  <time dateTime={h.at}>{fmtTimestamp(h.at)}</time>
                </li>
              ))}
            </ol>
          </div>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}

        <div className="dialog-foot">
          {job && <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(job)}>Delete</button>}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </dialog>
  );
}
