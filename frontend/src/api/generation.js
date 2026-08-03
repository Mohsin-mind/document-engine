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

export const getSubmissionJobs = (submissionId) =>
  request(`${API}/submissions/${submissionId}/jobs`);

export const jobEventsUrl = (submissionId) =>
  `${API}/submissions/${submissionId}/jobs/events`;
