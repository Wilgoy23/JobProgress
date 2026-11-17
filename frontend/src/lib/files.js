import { STATUS_LABEL } from './constants.js';
import { portalName } from './format.js';

export function download(filename, content, type) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function jobsToCsv(jobs) {
  const cell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheets from treating text as a formula
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = ['Company', 'Role', 'Status', 'Date Applied', 'Follow Up', 'Location', 'Salary', 'Job Site', 'Link', 'Notes', 'Last Updated'];
  const rows = jobs.map((j) => [
    j.company, j.role, STATUS_LABEL[j.status], j.date_applied, j.follow_up, j.location, j.salary,
    portalName(j.url), j.url, j.notes, j.updated_at,
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
