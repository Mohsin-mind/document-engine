'use strict';

const {
  Submission,
  GenerationJob,
  Artifact,
  ReviewArtifact,
  DocumentDefinition,
  TemplateVersion,
  Template,
} = require('../../db');
const { getStorage } = require('../../common/storage');
const { NotFoundError, ConflictError } = require('../../common/errors');
const { convertToPdf } = require('../../../workers/render.service');

// ── helpers ─────────────────────────────────────────────────────────────────

function toArtifactDto(artifact) {
  const storage = getStorage();
  const review = artifact.ReviewArtifact;
  return {
    id: artifact.id,
    kind: artifact.kind,
    source: artifact.source,
    url: `/api/artifacts/${artifact.id}/download`,
    review: review
      ? {
          id: review.id,
          status: review.status,
          reviewerNote: review.reviewerNote,
          reviewedAt: review.reviewedAt,
          approvedAt: review.approvedAt,
          hasReviewedDocx: !!review.reviewedDocxKey,
          hasReviewedPdf: !!review.reviewedPdfKey,
          reviewedDocxUrl: review.reviewedDocxKey
            ? `/api/review-artifacts/${review.id}/download/docx`
            : null,
          reviewedPdfUrl: review.reviewedPdfKey
            ? `/api/review-artifacts/${review.id}/download/pdf`
            : null,
        }
      : null,
  };
}

function toJobDto(job) {
  const def = job.DocumentDefinition;
  return {
    id: job.id,
    submissionId: job.submissionId,
    documentName: def?.name || 'Document',
    templateName: def?.TemplateVersion?.Template?.name || null,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    error: job.error,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    artifacts: (job.artifacts || []).map(toArtifactDto),
  };
}

function toSubmissionDto(submission) {
  return {
    id: submission.id,
    status: submission.status,
    submittedAt: submission.submittedAt,
    createdAt: submission.createdAt,
    jobs: (submission.jobs || []).map(toJobDto),
  };
}

// ── queries ──────────────────────────────────────────────────────────────────

async function listSubmissions({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { count, rows } = await Submission.findAndCountAll({
    where: { status: 'submitted' },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
    include: [
      {
        model: GenerationJob,
        as: 'jobs',
        include: [
          {
            model: Artifact,
            as: 'artifacts',
            include: [ReviewArtifact],
          },
          {
            model: DocumentDefinition,
            include: [{ model: TemplateVersion, include: [{ model: Template }] }],
          },
        ],
      },
    ],
  });
  return {
    total: count,
    page,
    limit,
    data: rows.map(toSubmissionDto),
  };
}

async function getSubmissionWithJobs(submissionId) {
  const submission = await Submission.findByPk(submissionId, {
    include: [
      {
        model: GenerationJob,
        as: 'jobs',
        include: [
          {
            model: Artifact,
            as: 'artifacts',
            include: [ReviewArtifact],
          },
          {
            model: DocumentDefinition,
            include: [{ model: TemplateVersion, include: [{ model: Template }] }],
          },
        ],
      },
    ],
  });
  if (!submission) throw new NotFoundError('Submission not found');
  return toSubmissionDto(submission);
}

// ── review actions ────────────────────────────────────────────────────────────

/**
 * Upload a reviewed DOCX for the DOCX artifact of a generation job.
 * - Stores the reviewed DOCX as a new key.
 * - Auto-converts to PDF via LibreOffice.
 * - Creates or updates the review_artifact row.
 */
async function uploadReviewedDocx(artifactId, fileBuffer, reviewerNote = '') {
  const artifact = await Artifact.findByPk(artifactId);
  if (!artifact) throw new NotFoundError('Artifact not found');
  if (artifact.kind !== 'docx') {
    throw new ConflictError('Only DOCX artifacts can be uploaded for review');
  }

  const storage = getStorage();
  const reviewedDocxKey = `artifacts/reviewed/${artifactId}/reviewed.docx`;

  // store reviewed docx
  await storage.save({ key: reviewedDocxKey, data: fileBuffer });

  // convert reviewed docx → pdf
  let reviewedPdfKey = null;
  try {
    const pdfBuffer = await convertToPdf(fileBuffer);
    reviewedPdfKey = `artifacts/reviewed/${artifactId}/reviewed.pdf`;
    await storage.save({ key: reviewedPdfKey, data: pdfBuffer });
  } catch (err) {
    console.error(`[review] PDF conversion failed for artifact ${artifactId}:`, err.message);
    // not fatal — reviewer can still approve without a PDF
  }

  const [review, created] = await ReviewArtifact.upsert(
    {
      artifactId,
      status: 'pending',
      reviewedDocxKey,
      reviewedPdfKey,
      reviewerNote: reviewerNote || '',
      reviewedAt: new Date(),
      approvedAt: null,
    },
    { returning: true }
  );

  return {
    id: review.id,
    artifactId,
    status: review.status,
    reviewedDocxUrl: `/api/review-artifacts/${review.id}/download/docx`,
    reviewedPdfUrl: reviewedPdfKey ? `/api/review-artifacts/${review.id}/download/pdf` : null,
    reviewerNote: review.reviewerNote,
    reviewedAt: review.reviewedAt,
  };
}

/**
 * Approve a review_artifact: mark it approved + timestamp.
 */
async function approveReview(reviewArtifactId) {
  const review = await ReviewArtifact.findByPk(reviewArtifactId);
  if (!review) throw new NotFoundError('Review not found');
  if (review.status === 'approved') throw new ConflictError('Already approved');
  if (!review.reviewedDocxKey) {
    throw new ConflictError('Cannot approve — no reviewed DOCX has been uploaded');
  }
  await review.update({ status: 'approved', approvedAt: new Date() });
  return { id: review.id, status: review.status, approvedAt: review.approvedAt };
}

/**
 * Reject a review_artifact.
 */
async function rejectReview(reviewArtifactId, note = '') {
  const review = await ReviewArtifact.findByPk(reviewArtifactId);
  if (!review) throw new NotFoundError('Review not found');
  await review.update({ status: 'rejected', reviewerNote: note });
  return { id: review.id, status: review.status };
}

/**
 * Stream a reviewed file (docx or pdf).
 */
async function getReviewedBuffer(reviewArtifactId, kind) {
  const review = await ReviewArtifact.findByPk(reviewArtifactId);
  if (!review) throw new NotFoundError('Review artifact not found');
  const key = kind === 'pdf' ? review.reviewedPdfKey : review.reviewedDocxKey;
  if (!key) throw new NotFoundError(`No reviewed ${kind.toUpperCase()} available`);
  const storage = getStorage();
  return { buffer: await storage.read({ key }), key };
}

module.exports = {
  listSubmissions,
  getSubmissionWithJobs,
  uploadReviewedDocx,
  approveReview,
  rejectReview,
  getReviewedBuffer,
};
