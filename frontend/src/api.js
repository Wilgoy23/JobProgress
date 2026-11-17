// Thin wrapper around the FastAPI backend.

function errorMessage(data, res) {
  const detail = data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : '';
        const msg = String(e.msg || '').replace(/^Value error, /, '');
        return field && field !== 'body' ? `${String(field).replace('_', ' ')}: ${msg}` : msg;
      })
      .join('; ');
  }
  if (res.status >= 500) return `The backend isn't responding (HTTP ${res.status}). Is it running?`;
  return `Request failed (HTTP ${res.status})`;
}

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the backend. Is it running?");
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) throw new Error(errorMessage(data, res));
  return data;
}

const jobPath = (id) => `/jobs/${encodeURIComponent(id)}`;

export const api = {
  listJobs: () => request('/jobs'),
  createJob: (job) => request('/jobs', { method: 'POST', body: job }),
  updateJob: (id, changes) => request(jobPath(id), { method: 'PATCH', body: changes }),
  deleteJob: (id) => request(jobPath(id), { method: 'DELETE' }),
  exportAll: () => request('/export'),
  importJobs: (jobs) => request('/import', { method: 'POST', body: jobs }),
};
