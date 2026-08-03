import { useEffect, useState } from 'react';
import { getSubmissionJobs, jobEventsUrl } from '../../api/generation.js';

const STATUS_LABELS = {
  queued: 'Queued',
  rendering_docx: 'Rendering DOCX',
  converting_pdf: 'Converting to PDF',
  completed: 'Completed',
  failed: 'Failed',
};

const STATUS_STYLES = {
  queued: 'bg-gray-100 text-gray-700',
  rendering_docx: 'bg-indigo-50 text-indigo-700',
  converting_pdf: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

function applyFresh(prev, fresh) {
  const map = new Map(prev.map((j) => [j.id, j]));
  for (const job of fresh) map.set(job.id, job);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export default function GenerationStatus({ submissionId }) {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initial = await getSubmissionJobs(submissionId);
        if (!cancelled) setJobs(initial);
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    })();

    const es = new EventSource(jobEventsUrl(submissionId));
    es.onmessage = (ev) => {
      let payload;
      try {
        payload = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (payload.job) {
        setJobs((prev) => {
          const idx = prev.findIndex((j) => j.id === payload.job.id);
          if (idx === -1) return [payload.job, ...prev];
          const next = [...prev];
          next[idx] = payload.job;
          return next;
        });
      }
    };
    return () => {
      cancelled = true;
      es.close();
    };
  }, [submissionId]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (jobs.length === 0) {
    return (
      <p className="text-sm text-gray-500">No documents are configured for this questionnaire yet.</p>
    );
  }

  return (
    <div className="mt-6 text-left space-y-2">
      {jobs.map((job) => (
        <div key={job.id} className="rounded-md border border-gray-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800">{job.documentName}</p>
              {job.templateName && (
                <p className="text-xs text-gray-500">Template: {job.templateName}</p>
              )}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                STATUS_STYLES[job.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {STATUS_LABELS[job.status] || job.status}
            </span>
          </div>
          <div className="mt-2 h-1 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                job.status === 'failed' ? 'bg-red-400' : 'bg-indigo-600'
              }`}
              style={{ width: `${job.progress || 0}%` }}
            />
          </div>
          {job.error && (
            <p className="mt-2 text-xs text-red-600 break-all">
              {job.error.message} {job.error.attempts > 0 ? `(after ${job.error.attempts} attempts)` : ''}
            </p>
          )}
          {job.status === 'completed' && job.artifacts.length > 0 && (
            <div className="mt-2 flex gap-2">
              {job.artifacts.map((artifact) => (
                <a
                  key={artifact.id}
                  href={artifact.url}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Download {artifact.kind.toUpperCase()}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
