const BASE = '/api/admin/rules';

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

export const listRules = (questionSetId) =>
  request(`${BASE}${questionSetId ? `?questionSetId=${questionSetId}` : ''}`);
export const getRule = (id) => request(`${BASE}/${id}`);
export const createRule = (payload) => request(BASE, { method: 'POST', body: JSON.stringify(payload) });
export const updateRule = (id, payload) =>
  request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const publishRule = (id) => request(`${BASE}/${id}/publish`, { method: 'POST' });
export const testRule = (id, answers) =>
  request(`${BASE}/${id}/test`, { method: 'POST', body: JSON.stringify({ answers }) });
export const generateSampleRule = (id) =>
  request(`${BASE}/${id}/generate-sample`, { method: 'POST' });
export const deleteRule = (id) => request(`${BASE}/${id}`, { method: 'DELETE' });
