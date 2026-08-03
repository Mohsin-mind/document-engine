const API = '/api';

async function request(url) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body;
}

export const getDownloads = (page = 1) => request(`${API}/downloads?page=${page}`);
