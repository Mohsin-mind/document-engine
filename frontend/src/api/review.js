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
  return body;
}

async function multipartRequest(url, formData) {
  const res = await fetch(url, { method: 'POST', body: formData });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body.error?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body.data;
}

export const getReviewSubmissions = (page = 1) =>
  request(`${API}/review/submissions?page=${page}`);

export const getReviewSubmission = (submissionId) =>
  request(`${API}/review/submissions/${submissionId}`).then((b) => b.data);

export const uploadReviewedDocx = (artifactId, file, reviewerNote = '') => {
  const form = new FormData();
  form.append('file', file);
  form.append('reviewerNote', reviewerNote);
  return multipartRequest(`${API}/review/artifacts/${artifactId}/upload`, form);
};

export const approveReview = (reviewArtifactId) =>
  request(`${API}/review-artifacts/${reviewArtifactId}/approve`, { method: 'POST' }).then(
    (b) => b.data
  );

export const rejectReview = (reviewArtifactId, note = '') =>
  request(`${API}/review-artifacts/${reviewArtifactId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  }).then((b) => b.data);
