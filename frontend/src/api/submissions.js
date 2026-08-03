const API = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || `Request failed (${res.status})`;
    const details = body.error?.details;
    throw new Error(details ? `${msg}: ${details.join('; ')}` : msg);
  }
  return body.data;
}

export const getQuestionnaire = () => request(`${API}/questionnaire`);
export const createSubmission = (answers) => request(`${API}/submissions`, { method: 'POST', body: JSON.stringify({ answers }) });
export const getSubmission = (id) => request(`${API}/submissions/${id}`);
export const saveSubmission = (id, answers) => request(`${API}/submissions/${id}`, { method: 'PUT', body: JSON.stringify({ answers }) });
export const submitSubmission = (id) => request(`${API}/submissions/${id}/submit`, { method: 'POST' });
