import { useEffect, useState } from 'react';
import { getDownloads } from '../../api/downloads.js';

const JOB_STATUS_COLOR = {
  queued: 'bg-gray-100 text-gray-600',
  rendering_docx: 'bg-indigo-50 text-indigo-700',
  converting_pdf: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const JOB_STATUS_LABEL = {
  queued: 'Queued',
  rendering_docx: 'Rendering',
  converting_pdf: 'Converting',
  completed: 'Completed',
  failed: 'Failed',
};

function ArtifactPill({ artifact }) {
  const review = artifact.review;
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={artifact.url}
          className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-gray-50 font-medium"
        >
          ↓ {artifact.kind.toUpperCase()}
          <span className="text-gray-400 font-normal">(original)</span>
        </a>
        {review?.reviewedDocxUrl && (
          <a
            href={review.reviewedDocxUrl}
            className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-0.5 text-blue-700 hover:bg-blue-50"
          >
            ↓ DOCX <span className="text-blue-400">(reviewed)</span>
          </a>
        )}
        {review?.reviewedPdfUrl && (
          <a
            href={review.reviewedPdfUrl}
            className="inline-flex items-center gap-1 rounded border border-blue-300 px-2 py-0.5 text-blue-700 hover:bg-blue-50"
          >
            ↓ PDF <span className="text-blue-400">(reviewed)</span>
          </a>
        )}
      </div>
      {review && (
        <span
          className={`self-start rounded-full px-2 py-0.5 text-xs font-medium ${
            review.status === 'approved'
              ? 'bg-green-100 text-green-700'
              : review.status === 'rejected'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-50 text-yellow-700'
          }`}
        >
          Review: {review.status}
          {review.status === 'approved' && review.approvedAt
            ? ` · ${new Date(review.approvedAt).toLocaleDateString()}`
            : ''}
        </span>
      )}
    </div>
  );
}

function JobRow({ job }) {
  const allArtifacts = job.artifacts || [];
  const hasArtifacts = allArtifacts.length > 0;

  return (
    <div className="border-t border-gray-100 px-5 py-3 flex items-start justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-gray-800 text-sm">{job.documentName}</p>
          {job.templateName && (
            <span className="text-xs text-gray-400">— {job.templateName}</span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              JOB_STATUS_COLOR[job.status] || 'bg-gray-100 text-gray-600'
            }`}
          >
            {JOB_STATUS_LABEL[job.status] || job.status}
          </span>
        </div>
        {job.completedAt && (
          <p className="text-xs text-gray-400 mt-0.5">
            Completed {new Date(job.completedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {hasArtifacts ? (
          allArtifacts.map((a) => <ArtifactPill key={a.id} artifact={a} />)
        ) : (
          <span className="text-xs text-gray-400">
            {job.status === 'failed' ? 'Generation failed — no files' : 'Processing…'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DownloadsPage() {
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const result = await getDownloads(p);
      setSubmissions(result.data || []);
      setTotal(result.total || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(page);
  }, [page]);

  const totalPages = Math.ceil(total / LIMIT);
  const totalDocs = submissions.reduce((acc, s) => acc + s.jobs.length, 0);
  const completedDocs = submissions.reduce(
    (acc, s) => acc + s.jobs.filter((j) => j.status === 'completed').length,
    0
  );
  const approvedDocs = submissions.reduce(
    (acc, s) =>
      acc +
      s.jobs.filter((j) => j.artifacts.some((a) => a.review?.status === 'approved')).length,
    0
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Download Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            All generated documents — original and reviewed versions.
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      {!loading && submissions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Submissions', value: total },
            { label: 'Documents Generated', value: `${completedDocs} / ${totalDocs}` },
            { label: 'Approved', value: approvedDocs },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border border-gray-200 bg-white p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && submissions.length === 0 && (
        <p className="text-sm text-gray-400">Loading…</p>
      )}

      {!loading && submissions.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-400 text-sm">No documents yet.</p>
          <p className="text-gray-300 text-xs mt-1">
            Submit a questionnaire from the Simulation page to generate documents.
          </p>
        </div>
      )}

      {/* Submission list */}
      <div className="space-y-4">
        {submissions.map((submission) => (
          <div
            key={submission.id}
            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
          >
            {/* Submission header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-b border-gray-100">
              <div>
                <p className="text-xs font-mono text-gray-500">{submission.id}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Submitted{' '}
                  {new Date(submission.submittedAt || submission.createdAt).toLocaleString()}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600">
                {submission.jobs.length} doc{submission.jobs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Jobs */}
            {submission.jobs.length === 0 ? (
              <p className="px-5 py-3 text-sm text-gray-400">No jobs found.</p>
            ) : (
              submission.jobs.map((job) => <JobRow key={job.id} job={job} />)
            )}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-3 text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-gray-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded border border-gray-300 px-3 py-1 disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
