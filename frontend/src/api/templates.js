const BASE = '/api/admin/templates';

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
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

export const listTemplates = () => request(BASE);
export const getTemplate = (id) => request(`${BASE}/${id}`);
export const updateTemplate = (id, payload) =>
  request(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const createTemplate = (formData) =>
  request(BASE, { method: 'POST', body: formData });
export const saveMappings = (id, versionId, payload) =>
  request(`${BASE}/${id}/versions/${versionId}/mappings`, { method: 'POST', body: JSON.stringify(payload) });
export const runRenderTest = (id, versionId, sampleCanonical) =>
  request(`${BASE}/${id}/versions/${versionId}/test`, { method: 'POST', body: JSON.stringify({ sampleCanonical }) });
export const publishTemplate = (id, versionId) =>
  request(`${BASE}/${id}/versions/${versionId}/publish`, { method: 'POST' });
export const generateSampleCanonical = (id) => request(`${BASE}/${id}/generate-sample`, { method: 'POST' });
export const deleteTemplate = (id) => request(`${BASE}/${id}`, { method: 'DELETE' });
