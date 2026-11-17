import { STATUSES } from '../lib/constants.js';

export const SORTS = [
  { id: 'updated', label: 'Recently updated' },
  { id: 'applied-desc', label: 'Date applied (newest)' },
  { id: 'applied-asc', label: 'Date applied (oldest)' },
  { id: 'followup', label: 'Follow-up (soonest)' },
  { id: 'company', label: 'Company (A–Z)' },
  { id: 'status', label: 'Status' },
];

export default function Toolbar({ view, onChange }) {
  return (
    <section className="toolbar" aria-label="Search and filters">
      <input
        type="search"
        placeholder="Search company, role, location, notes…"
        aria-label="Search"
        value={view.q}
        onChange={(e) => onChange({ q: e.target.value })}
      />
      <select aria-label="Filter by status" value={view.status} onChange={(e) => onChange({ status: e.target.value })}>
        <option value="all">All statuses</option>
        <option value="active">In progress</option>
        <option value="closed">Closed</option>
        {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select aria-label="Sort" value={view.sort} onChange={(e) => onChange({ sort: e.target.value })}>
        {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
    </section>
  );
}
