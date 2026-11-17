import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import Header from './components/Header.jsx';
import JobDialog from './components/JobDialog.jsx';
import JobList from './components/JobList.jsx';
import StatsBar from './components/StatsBar.jsx';
import Toast from './components/Toast.jsx';
import Toolbar from './components/Toolbar.jsx';
import { ACTIVE, CLOSED, STATUS_LABEL, STATUS_ORDER } from './lib/constants.js';
import { download, jobsToCsv } from './lib/files.js';
import { portalName, todayStr } from './lib/format.js';

function matchesFilter(job, filter) {
  switch (filter) {
    case 'all': return true;
    case 'active': return ACTIVE.has(job.status);
    case 'closed': return CLOSED.has(job.status);
    default: return job.status === filter;
  }
}

// Empty dates always sort last.
const byDate = (key, dir) => (a, b) => {
  if (!a[key] && !b[key]) return 0;
  if (!a[key]) return 1;
  if (!b[key]) return -1;
  return dir * a[key].localeCompare(b[key]);
};
const byUpdated = (a, b) => b.updated_at.localeCompare(a.updated_at);
const SORTERS = {
  updated: byUpdated,
  'applied-desc': byDate('date_applied', -1),
  'applied-asc': byDate('date_applied', 1),
  followup: byDate('follow_up', 1),
  company: (a, b) => a.company.localeCompare(b.company, undefined, { sensitivity: 'base' }),
  status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byUpdated(a, b),
};

function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const hideToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);
  const showToast = useCallback((message, action) => {
    clearTimeout(timer.current);
    setToast({ message, action });
    timer.current = setTimeout(() => setToast(null), action ? 6000 : 3500);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, showToast, hideToast };
}

export default function App() {
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState({ state: 'loading', error: '' });
  const [view, setView] = useState({ q: '', status: 'all', sort: 'updated' });
  // undefined = dialog closed, null = adding a new job, object = editing that job
  const [editing, setEditing] = useState(undefined);
  const { toast, showToast, hideToast } = useToast();

  const refresh = useCallback(async () => {
    try {
      setJobs(await api.listJobs());
      setStatus({ state: 'ready', error: '' });
    } catch (err) {
      setStatus({ state: 'error', error: err.message });
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Press "n" to add a job when you're not typing somewhere.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || editing !== undefined) return;
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      setEditing(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [editing]);

  const visibleJobs = useMemo(() => {
    const q = view.q.trim().toLowerCase();
    return jobs
      .filter((j) => matchesFilter(j, view.status))
      .filter((j) => !q || [j.company, j.role, j.location, j.salary, j.notes, portalName(j.url), STATUS_LABEL[j.status]]
        .join(' ').toLowerCase().includes(q))
      .sort(SORTERS[view.sort] || byUpdated);
  }, [jobs, view]);

  const upsertLocal = (job) =>
    setJobs((prev) => (prev.some((j) => j.id === job.id) ? prev.map((j) => (j.id === job.id ? job : j)) : [...prev, job]));

  // ----- actions -----
  async function handleSave(data) {
    // Errors propagate so the dialog can show them.
    const saved = editing ? await api.updateJob(editing.id, data) : await api.createJob(data);
    upsertLocal(saved);
    setEditing(undefined);
  }

  async function handleStatusChange(job, newStatus) {
    try {
      upsertLocal(await api.updateJob(job.id, { status: newStatus }));
    } catch (err) {
      showToast(`Couldn't update status: ${err.message}`);
    }
  }

  async function handleDelete(job) {
    setEditing(undefined);
    try {
      await api.deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      showToast(`Deleted ${job.company}`, {
        label: 'Undo',
        onClick: async () => {
          try {
            await api.importJobs([job]); // restores the same id, fields and history
            await refresh();
          } catch (err) {
            showToast(`Couldn't undo: ${err.message}`);
          }
        },
      });
    } catch (err) {
      showToast(`Delete failed: ${err.message}`);
    }
  }

  async function handleExportJson() {
    try {
      const data = await api.exportAll();
      download(`job-progress-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
    } catch (err) {
      showToast(`Export failed: ${err.message}`);
    }
  }

  function handleExportCsv() {
    download(`job-progress-${todayStr()}.csv`, jobsToCsv(visibleJobs), 'text/csv;charset=utf-8');
  }

  async function handleImport(file) {
    try {
      const data = JSON.parse(await file.text());
      const items = Array.isArray(data) ? data : data?.jobs;
      if (!Array.isArray(items)) throw new Error('no jobs found in that file');
      const { added, updated, skipped } = await api.importJobs(items);
      await refresh();
      showToast(`Imported ${added} new, ${updated} updated${skipped ? `, ${skipped} skipped (invalid)` : ''}`);
    } catch (err) {
      showToast(`Import failed: ${err.message}`);
    }
  }

  // ----- render -----
  let body;
  if (status.state === 'loading') {
    body = <p className="loading">Loading…</p>;
  } else if (status.state === 'error') {
    body = (
      <div className="banner" role="alert">
        <span>{status.error}</span>
        <button type="button" className="btn btn-ghost" onClick={refresh}>Retry</button>
      </div>
    );
  } else if (jobs.length === 0) {
    body = (
      <div className="empty">
        <p className="empty-title">No applications yet</p>
        <p className="empty-sub">Add the first job you've applied to and it'll show up here.</p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>+ Add job</button>
      </div>
    );
  } else if (visibleJobs.length === 0) {
    body = (
      <div className="empty">
        <p className="empty-title">Nothing matches</p>
        <p className="empty-sub no-margin">Try a different search or status filter.</p>
      </div>
    );
  } else {
    body = (
      <JobList
        jobs={visibleJobs}
        onEdit={setEditing}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
      />
    );
  }

  return (
    <>
      <Header
        onAdd={() => setEditing(null)}
        onExportJson={handleExportJson}
        onExportCsv={handleExportCsv}
        onImportFile={handleImport}
      />
      <main>
        <StatsBar jobs={jobs} activeFilter={view.status} onFilter={(f) => setView((v) => ({ ...v, status: f }))} />
        <Toolbar view={view} onChange={(patch) => setView((v) => ({ ...v, ...patch }))} />
        {body}
      </main>

      {editing !== undefined && (
        <JobDialog
          key={editing?.id ?? 'new'}
          job={editing}
          onClose={() => setEditing(undefined)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      <Toast toast={toast} onDismiss={hideToast} />
    </>
  );
}
