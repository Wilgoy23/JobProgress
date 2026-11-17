(() => {
  'use strict';

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------
  const STORAGE_KEY = 'jobprogress.v1';

  const STATUSES = [
    { id: 'saved', label: 'Saved' },
    { id: 'applied', label: 'Applied' },
    { id: 'assessment', label: 'Assessment' },
    { id: 'interviewing', label: 'Interviewing' },
    { id: 'offer', label: 'Offer' },
    { id: 'rejected', label: 'Rejected' },
    { id: 'withdrawn', label: 'Withdrawn' },
    { id: 'ghosted', label: 'Ghosted' },
  ];
  const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));
  const STATUS_ORDER = Object.fromEntries(STATUSES.map((s, i) => [s.id, i]));
  const ACTIVE = new Set(['applied', 'assessment', 'interviewing']);
  const CLOSED = new Set(['rejected', 'withdrawn', 'ghosted']);

  // Hostname patterns -> friendly job-site name shown on the link button.
  const PORTALS = [
    [/(^|\.)(myworkdayjobs|myworkdaysite|workday)\.com$/, 'Workday'],
    [/(^|\.)greenhouse\.io$/, 'Greenhouse'],
    [/(^|\.)lever\.co$/, 'Lever'],
    [/(^|\.)ashbyhq\.com$/, 'Ashby'],
    [/(^|\.)icims\.com$/, 'iCIMS'],
    [/(^|\.)smartrecruiters\.com$/, 'SmartRecruiters'],
    [/(^|\.)taleo\.net$/, 'Taleo'],
    [/(^|\.)(successfactors|sapsf)\.(com|eu)$/, 'SuccessFactors'],
    [/(^|\.)oraclecloud\.com$/, 'Oracle'],
    [/(^|\.)jobvite\.com$/, 'Jobvite'],
    [/(^|\.)bamboohr\.com$/, 'BambooHR'],
    [/(^|\.)workable\.com$/, 'Workable'],
    [/(^|\.)linkedin\.com$/, 'LinkedIn'],
    [/(^|\.)indeed\.com$/, 'Indeed'],
    [/(^|\.)glassdoor\.[a-z.]+$/, 'Glassdoor'],
    [/(^|\.)joinhandshake\.com$/, 'Handshake'],
    [/(^|\.)wellfound\.com$/, 'Wellfound'],
    [/(^|\.)ziprecruiter\.com$/, 'ZipRecruiter'],
  ];

  // ---------------------------------------------------------------------------
  // DOM
  // ---------------------------------------------------------------------------
  const $ = (sel) => document.querySelector(sel);
  const el = {
    stats: $('#stats'),
    list: $('#list'),
    listHeader: $('.list-header'),
    empty: $('#empty'),
    noResults: $('#no-results'),
    search: $('#search'),
    filter: $('#filter-status'),
    sort: $('#sort'),
    dialog: $('#job-dialog'),
    form: $('#job-form'),
    dialogTitle: $('#dialog-title'),
    portalHint: $('#portal-hint'),
    history: $('#history'),
    historyList: $('#history-list'),
    deleteBtn: $('#btn-delete'),
    importFile: $('#import-file'),
    toast: $('#toast'),
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const nowIso = () => new Date().toISOString();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function dayNum(s) {
    const [y, m, d] = s.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
  }

  function fmtDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    const opts = { month: 'short', day: 'numeric' };
    if (y !== new Date().getFullYear()) opts.year = 'numeric';
    return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
  }

  function relDays(s) {
    const diff = dayNum(s) - dayNum(todayStr());
    if (diff === 0) return 'today';
    if (diff === -1) return 'yesterday';
    if (diff === 1) return 'tomorrow';
    return diff < 0 ? `${-diff} days ago` : `in ${diff} days`;
  }

  function fmtTimestamp(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // Accepts links pasted without a scheme; rejects anything that isn't http(s).
  function normalizeUrl(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      if (!u.hostname.includes('.')) return '';
      return u.href;
    } catch {
      return '';
    }
  }

  function portalName(url) {
    if (!url) return '';
    let host;
    try { host = new URL(url).hostname.toLowerCase(); } catch { return ''; }
    for (const [re, name] of PORTALS) if (re.test(host)) return name;
    return host.replace(/^www\./, '');
  }

  // Coerce anything (stored data, imported file) into a well-formed job.
  function sanitizeJob(j) {
    if (!j || typeof j !== 'object') return null;
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const company = str(j.company);
    const role = str(j.role);
    if (!company && !role) return null;
    const status = STATUS_LABEL[j.status] ? j.status : 'applied';
    const created = str(j.createdAt) || nowIso();
    let history = Array.isArray(j.history)
      ? j.history.filter((h) => h && STATUS_LABEL[h.status] && typeof h.at === 'string').map((h) => ({ status: h.status, at: h.at }))
      : [];
    if (!history.length) history = [{ status, at: created }];
    return {
      id: str(j.id) || uid(),
      company,
      role,
      url: normalizeUrl(str(j.url)),
      status,
      dateApplied: isDate(j.dateApplied) ? j.dateApplied : '',
      followUp: isDate(j.followUp) ? j.followUp : '',
      location: str(j.location),
      salary: str(j.salary),
      notes: str(j.notes),
      createdAt: created,
      updatedAt: str(j.updatedAt) || created,
      history,
    };
  }

  function setStatus(job, status) {
    if (job.status === status) return;
    job.status = status;
    job.history.push({ status, at: nowIso() });
    if (status !== 'saved' && !job.dateApplied) job.dateApplied = todayStr();
  }

  // ---------------------------------------------------------------------------
  // State & storage
  // ---------------------------------------------------------------------------
  let jobs = load();
  const view = { q: '', status: 'all', sort: 'updated' };
  let editingId = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.map(sanitizeJob).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    } catch {
      toast('Could not save: browser storage is unavailable. Export a backup!');
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------
  function matchesFilter(j) {
    switch (view.status) {
      case 'all': return true;
      case 'active': return ACTIVE.has(j.status);
      case 'closed': return CLOSED.has(j.status);
      default: return j.status === view.status;
    }
  }

  function visibleJobs() {
    const q = view.q.trim().toLowerCase();
    const list = jobs.filter((j) => {
      if (!matchesFilter(j)) return false;
      if (!q) return true;
      return [j.company, j.role, j.location, j.salary, j.notes, portalName(j.url), STATUS_LABEL[j.status]]
        .join(' ').toLowerCase().includes(q);
    });

    // Empty dates always sort last.
    const byDate = (key, dir) => (a, b) => {
      if (!a[key] && !b[key]) return 0;
      if (!a[key]) return 1;
      if (!b[key]) return -1;
      return dir * a[key].localeCompare(b[key]);
    };
    const byUpdated = (a, b) => b.updatedAt.localeCompare(a.updatedAt);
    const sorters = {
      updated: byUpdated,
      'applied-desc': byDate('dateApplied', -1),
      'applied-asc': byDate('dateApplied', 1),
      followup: byDate('followUp', 1),
      company: (a, b) => a.company.localeCompare(b.company, undefined, { sensitivity: 'base' }),
      status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || byUpdated(a, b),
    };
    return list.sort(sorters[view.sort] || byUpdated);
  }

  function renderStats() {
    const count = (pred) => jobs.filter(pred).length;
    const submitted = jobs.filter((j) => j.status !== 'saved');
    const reachedInterview = submitted.filter((j) => j.history.some((h) => h.status === 'interviewing' || h.status === 'offer')).length;
    const rate = submitted.length ? Math.round((reachedInterview / submitted.length) * 100) + '%' : '—';

    const tiles = [
      { filter: 'all', label: 'Total', value: jobs.length },
      { filter: 'active', label: 'In progress', value: count((j) => ACTIVE.has(j.status)) },
      { filter: 'interviewing', label: 'Interviewing', value: count((j) => j.status === 'interviewing') },
      { filter: 'offer', label: 'Offers', value: count((j) => j.status === 'offer') },
      { filter: 'closed', label: 'Closed', value: count((j) => CLOSED.has(j.status)) },
      { filter: null, label: 'Interview rate', value: rate, title: 'Share of submitted applications that reached an interview or offer' },
    ];

    el.stats.innerHTML = tiles.map((t) => t.filter
      ? `<button type="button" class="stat" data-filter="${t.filter}" aria-pressed="${view.status === t.filter}">
           <span class="stat-value">${t.value}</span><span class="stat-label">${t.label}</span>
         </button>`
      : `<div class="stat static" title="${esc(t.title)}">
           <span class="stat-value">${t.value}</span><span class="stat-label">${t.label}</span>
         </div>`
    ).join('');
  }

  const ICON_EDIT = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  const ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function rowHtml(j) {
    const today = todayStr();
    const meta = [j.location, j.salary].filter(Boolean).map(esc).join(' · ');
    const open = !CLOSED.has(j.status) && j.status !== 'offer';
    const due = j.followUp && open && j.followUp <= today;

    const applied = j.dateApplied
      ? `${fmtDate(j.dateApplied)}<span class="sub">${relDays(j.dateApplied)}</span>`
      : '<span class="dim">—</span>';
    const follow = j.followUp
      ? `<span class="${due ? 'due' : ''}">${fmtDate(j.followUp)}</span><span class="sub">${due ? 'due ' : ''}${relDays(j.followUp)}</span>`
      : '<span class="dim">—</span>';
    const link = j.url
      ? `<a class="portal-link" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer" title="${esc(j.url)}">${esc(portalName(j.url))} <span aria-hidden="true">↗</span></a>`
      : '<span class="dim">No link</span>';
    const options = STATUSES.map((s) => `<option value="${s.id}"${s.id === j.status ? ' selected' : ''}>${s.label}</option>`).join('');
    const name = esc(j.company || j.role);

    return `<div class="row" role="listitem" data-id="${esc(j.id)}">
      <div class="cell cell-job">
        <button type="button" class="job-title" data-action="edit">${esc(j.company || '(no company)')}</button>
        <div class="role">${esc(j.role)}</div>
        ${meta ? `<div class="meta">${meta}</div>` : ''}
        ${j.notes ? `<div class="notes" title="${esc(j.notes)}">${esc(j.notes)}</div>` : ''}
      </div>
      <div class="cell cell-status">
        <select class="status-select" data-status="${j.status}" aria-label="Status for ${name}">${options}</select>
      </div>
      <div class="cell cell-applied"><span class="cell-label">Applied</span>${applied}</div>
      <div class="cell cell-follow"><span class="cell-label">Follow up</span>${follow}</div>
      <div class="cell cell-link">${link}</div>
      <div class="cell cell-actions">
        <button type="button" class="icon-btn" data-action="edit" aria-label="Edit ${name}" title="Edit">${ICON_EDIT}</button>
        <button type="button" class="icon-btn danger" data-action="delete" aria-label="Delete ${name}" title="Delete">${ICON_TRASH}</button>
      </div>
    </div>`;
  }

  function renderList() {
    const list = visibleJobs();
    el.list.innerHTML = list.map(rowHtml).join('');
    el.empty.hidden = jobs.length > 0;
    el.noResults.hidden = jobs.length === 0 || list.length > 0;
    el.listHeader.hidden = list.length === 0;
  }

  function render() {
    renderStats();
    renderList();
  }

  // ---------------------------------------------------------------------------
  // Add / edit dialog
  // ---------------------------------------------------------------------------
  const f = el.form.elements;

  function updatePortalHint() {
    const raw = f.url.value.trim();
    if (!raw) { el.portalHint.textContent = ''; return; }
    const url = normalizeUrl(raw);
    el.portalHint.textContent = url ? `Job site: ${portalName(url)}` : 'That doesn’t look like a valid link.';
  }

  function renderHistory(job) {
    el.history.hidden = !job;
    if (!job) return;
    el.historyList.innerHTML = [...job.history].reverse().map((h) =>
      `<li><span class="pill" data-status="${h.status}">${STATUS_LABEL[h.status]}</span><time datetime="${esc(h.at)}">${esc(fmtTimestamp(h.at))}</time></li>`
    ).join('');
  }

  function openForm(job = null) {
    editingId = job ? job.id : null;
    el.form.reset();
    el.dialogTitle.textContent = job ? 'Edit application' : 'Add application';
    el.deleteBtn.hidden = !job;

    f.company.value = job ? job.company : '';
    f.role.value = job ? job.role : '';
    f.url.value = job ? job.url : '';
    f.status.value = job ? job.status : 'applied';
    f.dateApplied.value = job ? job.dateApplied : todayStr();
    f.followUp.value = job ? job.followUp : '';
    f.location.value = job ? job.location : '';
    f.salary.value = job ? job.salary : '';
    f.notes.value = job ? job.notes : '';
    f.url.setCustomValidity('');

    updatePortalHint();
    renderHistory(job);
    el.dialog.showModal();
    f.company.focus();
  }

  function closeForm() {
    el.dialog.close();
    editingId = null;
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();

    const urlRaw = f.url.value.trim();
    const url = normalizeUrl(urlRaw);
    f.url.setCustomValidity(urlRaw && !url ? 'Enter a valid web link (e.g. https://…)' : '');
    if (!el.form.reportValidity()) return;

    const data = {
      company: f.company.value.trim(),
      role: f.role.value.trim(),
      url,
      dateApplied: f.dateApplied.value,
      followUp: f.followUp.value,
      location: f.location.value.trim(),
      salary: f.salary.value.trim(),
      notes: f.notes.value.trim(),
    };
    const status = f.status.value;

    if (editingId) {
      const job = jobs.find((j) => j.id === editingId);
      if (job) {
        Object.assign(job, data);
        setStatus(job, status);
        job.updatedAt = nowIso();
      }
    } else {
      const at = nowIso();
      jobs.push(sanitizeJob({ ...data, status, id: uid(), createdAt: at, updatedAt: at, history: [{ status, at }] }));
    }

    save();
    render();
    closeForm();
  });

  f.url.addEventListener('input', () => { f.url.setCustomValidity(''); updatePortalHint(); });
  el.dialog.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeForm));
  el.dialog.addEventListener('click', (e) => { if (e.target === el.dialog) closeForm(); }); // backdrop click
  el.deleteBtn.addEventListener('click', () => {
    const id = editingId;
    closeForm();
    deleteJob(id);
  });

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  function deleteJob(id) {
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx === -1) return;
    const [removed] = jobs.splice(idx, 1);
    save();
    render();
    toast(`Deleted ${removed.company || removed.role}`, 'Undo', () => {
      jobs.splice(Math.min(idx, jobs.length), 0, removed);
      save();
      render();
    });
  }

  el.list.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('.row').dataset.id;
    if (btn.dataset.action === 'edit') openForm(jobs.find((j) => j.id === id));
    if (btn.dataset.action === 'delete') deleteJob(id);
  });

  el.list.addEventListener('change', (e) => {
    if (!e.target.matches('.status-select')) return;
    const job = jobs.find((j) => j.id === e.target.closest('.row').dataset.id);
    if (!job) return;
    setStatus(job, e.target.value);
    job.updatedAt = nowIso();
    save();
    render();
  });

  el.stats.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-filter]');
    if (!tile) return;
    const next = tile.dataset.filter;
    view.status = view.status === next && next !== 'all' ? 'all' : next;
    el.filter.value = view.status;
    render();
  });

  el.search.addEventListener('input', () => { view.q = el.search.value; renderList(); });
  el.filter.addEventListener('change', () => { view.status = el.filter.value; render(); });
  el.sort.addEventListener('change', () => { view.sort = el.sort.value; renderList(); });

  $('#btn-add').addEventListener('click', () => openForm());
  $('#btn-add-empty').addEventListener('click', () => openForm());

  // "n" opens the add form when you're not typing somewhere.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey || el.dialog.open) return;
    if (e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    openForm();
  });

  // ---------------------------------------------------------------------------
  // Import / export
  // ---------------------------------------------------------------------------
  function download(filename, content, type) {
    const href = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement('a'), { href, download: filename });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  $('#btn-export-json').addEventListener('click', () => {
    const payload = { app: 'JobProgress', version: 1, exportedAt: nowIso(), jobs };
    download(`job-progress-${todayStr()}.json`, JSON.stringify(payload, null, 2), 'application/json');
  });

  $('#btn-export-csv').addEventListener('click', () => {
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets from treating text as a formula
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['Company', 'Role', 'Status', 'Date Applied', 'Follow Up', 'Location', 'Salary', 'Job Site', 'Link', 'Notes', 'Last Updated'];
    const rows = visibleJobs().map((j) => [
      j.company, j.role, STATUS_LABEL[j.status], j.dateApplied, j.followUp, j.location, j.salary,
      portalName(j.url), j.url, j.notes, j.updatedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    download(`job-progress-${todayStr()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
  });

  $('#btn-import').addEventListener('click', () => el.importFile.click());

  el.importFile.addEventListener('change', async () => {
    const file = el.importFile.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const arr = Array.isArray(data) ? data : data && data.jobs;
      if (!Array.isArray(arr)) throw new Error('no jobs found in that file');
      const incoming = arr.map(sanitizeJob).filter(Boolean);
      const byId = new Map(jobs.map((j) => [j.id, j]));
      let added = 0;
      let updated = 0;
      for (const j of incoming) {
        if (byId.has(j.id)) updated++; else added++;
        byId.set(j.id, j);
      }
      jobs = [...byId.values()];
      save();
      render();
      toast(`Imported ${added} new, ${updated} updated`);
    } catch (err) {
      toast(`Import failed: ${err.message}`);
    } finally {
      el.importFile.value = '';
    }
  });

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------
  let toastTimer;
  function toast(message, actionLabel, onAction) {
    clearTimeout(toastTimer);
    el.toast.innerHTML = `<span>${esc(message)}</span>`;
    if (actionLabel) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = actionLabel;
      b.addEventListener('click', () => { el.toast.hidden = true; onAction(); });
      el.toast.append(b);
    }
    el.toast.hidden = false;
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, actionLabel ? 6000 : 3500);
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  const statusOptions = STATUSES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  f.status.innerHTML = statusOptions;
  el.filter.innerHTML =
    '<option value="all">All statuses</option>' +
    '<option value="active">In progress</option>' +
    '<option value="closed">Closed</option>' +
    statusOptions;

  // Keep multiple tabs in sync.
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) { jobs = load(); render(); }
  });

  render();
})();
