import { ACTIVE, CLOSED } from '../lib/constants.js';

export default function StatsBar({ jobs, activeFilter, onFilter }) {
  const count = (pred) => jobs.filter(pred).length;
  const submitted = jobs.filter((j) => j.status !== 'saved');
  const reachedInterview = submitted.filter((j) =>
    j.history.some((h) => h.status === 'interviewing' || h.status === 'offer'),
  ).length;
  const rate = submitted.length ? `${Math.round((reachedInterview / submitted.length) * 100)}%` : '—';

  const tiles = [
    { filter: 'all', label: 'Total', value: jobs.length },
    { filter: 'active', label: 'In progress', value: count((j) => ACTIVE.has(j.status)) },
    { filter: 'interviewing', label: 'Interviewing', value: count((j) => j.status === 'interviewing') },
    { filter: 'offer', label: 'Offers', value: count((j) => j.status === 'offer') },
    { filter: 'closed', label: 'Closed', value: count((j) => CLOSED.has(j.status)) },
  ];

  return (
    <section className="stats" aria-label="Summary">
      {tiles.map((t) => (
        <button
          key={t.filter}
          type="button"
          className="stat"
          aria-pressed={activeFilter === t.filter}
          // Clicking the active tile again clears the filter.
          onClick={() => onFilter(activeFilter === t.filter ? 'all' : t.filter)}
        >
          <span className="stat-value">{t.value}</span>
          <span className="stat-label">{t.label}</span>
        </button>
      ))}
      <div className="stat static" title="Share of submitted applications that reached an interview or offer">
        <span className="stat-value">{rate}</span>
        <span className="stat-label">Interview rate</span>
      </div>
    </section>
  );
}
