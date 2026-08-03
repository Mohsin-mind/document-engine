const BASE = '/api/admin/question-sets';

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

export const listQuestionSets = () => request(BASE);
export const getQuestionSet = (id) => request(`${BASE}/${id}`);
export const createQuestionSet = (payload) =>
  request(BASE, { method: 'POST', body: JSON.stringify(payload) });
export const updateQuestionSet = (id, payload) =>
  request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const publishQuestionSet = (id) => request(`${BASE}/${id}/publish`, { method: 'POST' });
export const deleteQuestionSet = (id) => request(`${BASE}/${id}`, { method: 'DELETE' });
