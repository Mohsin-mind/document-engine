import { useEffect, useRef, useState } from 'react';
import {
  getReviewSubmissions,
  uploadReviewedDocx,
  approveReview,
  rejectReview,
} from '../../api/review.js';

const STATUS_LABEL = {
  queued: 'Queued',
  rendering_docx: 'Rendering DOCX',
  converting_pdf: 'Converting PDF',
  completed: 'Completed',
  failed: 'Failed',
};

const JOB_STATUS_COLOR = {
  queued: 'bg-gray-100 text-gray-600',
  rendering_docx: 'bg-indigo-50 text-indigo-700',
  converting_pdf: 'bg-indigo-50 text-indigo-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const REVIEW_STATUS_COLOR = {
  pending: 'bg-yellow-50 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};

function ArtifactRow({ artifact, jobId, onReviewUpdate }) {
  const fileRef = useRef();
  const [note, setNote] = useState('');
  const [rejectNote, setRejectNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [localError, setLocalError] = useState('');

  const review = artifact.review;
  const isDocx = artifact.kind === 'docx';

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setLocalError('');
    try {
      await uploadReviewedDocx(artifact.id, file, note);
      onReviewUpdate();
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
      setNote('');
    }
  };

  const handleApprove = async () => {
    setActing(true);
    setLocalError('');
    try {
      await approveReview(review.id);
      onReviewUpdate();
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    setActing(true);
    setLocalError('');
    try {
      await rejectReview(review.id, rejectNote);
      onReviewUpdate();
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setActing(false);
      setShowRejectInput(false);
      setRejectNote('');
    }
  };

  return (
    <div className="ml-6 mt-2 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium uppercase text-xs text-gray-500">{artifact.kind}</span>
          <span className="text-xs text-gray-400">({artifact.source})</span>
          {review && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${REVIEW_STATUS_COLOR[review.status] || 'bg-gray-100 text-gray-600'
                }`}
            >
              {review.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={artifact.url}
            className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-white"
          >
            ↓ Original {artifact.kind.toUpperCase()}
          </a>
          {review?.reviewedDocxUrl && (
            <a
              href={review.reviewedDocxUrl}
              className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
            >
              ↓ Reviewed DOCX
            </a>
          )}
          {review?.reviewedPdfUrl && (
            <a
              href={review.reviewedPdfUrl}
              className="rounded border border-blue-300 px-2 py-0.5 text-xs text-blue-700 hover:bg-blue-50"
            >
              ↓ Reviewed PDF
            </a>
          )}
        </div>
      </div>

      {localError && <p className="mt-1 text-xs text-red-600">{localError}</p>}

      {/* Upload reviewed DOCX – only for DOCX artifacts */}
      {isDocx && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              ref={fileRef}
              className="text-xs text-gray-600 file:mr-2 file:rounded file:border-0 file:bg-gray-200 file:px-2 file:py-1 file:text-xs file:cursor-pointer"
            />
            <input
              type="text"
              placeholder="Reviewer note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="flex-1 min-w-[140px] rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="rounded bg-indigo-600 px-3 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload Reviewed DOCX'}
            </button>
          </div>
        </div>
      )}

      {/* Approve / Reject – only if review exists and is pending */}
      {review && review.status === 'pending' && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleApprove}
            disabled={acting || !review.hasReviewedDocx}
            className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-500 disabled:opacity-50"
            title={!review.hasReviewedDocx ? 'Upload a reviewed DOCX first' : ''}
          >
            {acting ? 'Working…' : 'Approve'}
          </button>
          {!showRejectInput ? (
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={acting}
              className="rounded border border-red-300 px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Reject
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Reason (optional)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <button
                onClick={handleReject}
                disabled={acting}
                className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-500 disabled:opacity-50"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => setShowRejectInput(false)}
                className="text-xs text-gray-500 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {review?.status === 'approved' && review.approvedAt && (
        <p className="mt-1 text-xs text-green-700">
          ✓ Approved {new Date(review.approvedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function JobCard({ job, onReviewUpdate }) {
  const [open, setOpen] = useState(false);
  const docxArtifacts = job.artifacts.filter((a) => a.kind === 'docx' && a.source === 'original');

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <p className="font-medium text-gray-800">{job.documentName}</p>
          {job.templateName && <p className="text-xs text-gray-400">Template: {job.templateName}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${JOB_STATUS_COLOR[job.status] || 'bg-gray-100 text-gray-600'
              }`}
          >
            {STATUS_LABEL[job.status] || job.status}
          </span>
          <span className="text-gray-400 text-sm">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-2">
          {job.status !== 'completed' && (
            <p className="text-xs text-gray-500">
              {job.status === 'failed'
                ? `Failed: ${job.error?.message || 'unknown error'}`
                : 'Document is still being processed…'}
            </p>
          )}

          {job.status === 'completed' && docxArtifacts.length === 0 && (
            <p className="text-xs text-gray-500">No DOCX artifact found.</p>
          )}

          {docxArtifacts.map((artifact) => (
            <ArtifactRow
              key={artifact.id}
              artifact={artifact}
              jobId={job.id}
              onReviewUpdate={onReviewUpdate}
            />
          ))}

          {/* PDF artifacts (original, read-only) */}
          {job.artifacts
            .filter((a) => a.kind === 'pdf' && a.source === 'original')
            .map((artifact) => (
              <div
                key={artifact.id}
                className="ml-6 mt-2 flex items-center justify-between rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs"
              >
                <span className="text-gray-500 uppercase font-medium">PDF (original)</span>
                <a
                  href={artifact.url}
                  className="rounded border border-gray-300 px-2 py-0.5 text-gray-700 hover:bg-white"
                >
                  ↓ Download PDF
                </a>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function SubmissionCard({ submission, onReviewUpdate }) {
  const [open, setOpen] = useState(false);
  const allDone = submission.jobs.every((j) => j.status === 'completed' || j.status === 'failed');
  const anyApproved = submission.jobs.some((j) =>
    j.artifacts.some((a) => a.review?.status === 'approved')
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div>
          <p className="font-semibold text-gray-900 text-sm font-mono">{submission.id}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Submitted {new Date(submission.submittedAt || submission.createdAt).toLocaleString()} ·{' '}
            {submission.jobs.length} document{submission.jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {anyApproved && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              Partially Approved
            </span>
          )}
          {!allDone && (
            <span className="rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
              In Progress
            </span>
          )}
          <span className="text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-3 space-y-3">
          {submission.jobs.length === 0 && (
            <p className="text-sm text-gray-400">No generation jobs found.</p>
          )}
          {submission.jobs.map((job) => (
            <JobCard key={job.id} job={job} onReviewUpdate={onReviewUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ReviewPage() {
  const [submissions, setSubmissions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const LIMIT = 20;

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const result = await getReviewSubmissions(p);
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

  const handleReviewUpdate = () => load(page);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Workflow</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload reviewed DOCX files, generate reviewed PDFs, and approve documents.
          </p>
        </div>
        <button
          onClick={() => load(page)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && submissions.length === 0 && (
        <p className="text-sm text-gray-400">Loading submissions…</p>
      )}

      {!loading && submissions.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <p className="text-gray-400 text-sm">No submitted questionnaires found.</p>
          <p className="text-gray-300 text-xs mt-1">
            Submit a questionnaire from the Simulation page first.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {submissions.map((s) => (
          <SubmissionCard key={s.id} submission={s} onReviewUpdate={handleReviewUpdate} />
        ))}
      </div>

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
