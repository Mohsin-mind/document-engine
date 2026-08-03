const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../common/async-handler');
const service = require('./review.service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── List all submitted submissions with their jobs & artifacts ───────────────
router.get(
  '/review/submissions',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const result = await service.listSubmissions({ page, limit });
    res.json(result);
  })
);

// ── Get a single submission with all job/artifact detail ────────────────────
router.get(
  '/review/submissions/:submissionId',
  asyncHandler(async (req, res) => {
    const data = await service.getSubmissionWithJobs(req.params.submissionId);
    res.json({ data });
  })
);

// ── Upload reviewed DOCX for an artifact ────────────────────────────────────
// POST /api/review/artifacts/:artifactId/upload
// body: multipart form-data: file (docx), reviewerNote (optional text)
router.post(
  '/review/artifacts/:artifactId/upload',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: { message: 'No file uploaded' } });
    }
    const data = await service.uploadReviewedDocx(
      req.params.artifactId,
      req.file.buffer,
      req.body.reviewerNote || ''
    );
    res.status(201).json({ data });
  })
);

// ── Approve a review ─────────────────────────────────────────────────────────
router.post(
  '/review-artifacts/:reviewArtifactId/approve',
  asyncHandler(async (req, res) => {
    const data = await service.approveReview(req.params.reviewArtifactId);
    res.json({ data });
  })
);

// ── Reject a review ──────────────────────────────────────────────────────────
router.post(
  '/review-artifacts/:reviewArtifactId/reject',
  asyncHandler(async (req, res) => {
    const data = await service.rejectReview(req.params.reviewArtifactId, req.body.note || '');
    res.json({ data });
  })
);

// ── Download reviewed file ───────────────────────────────────────────────────
// GET /api/review-artifacts/:id/download/docx
// GET /api/review-artifacts/:id/download/pdf
router.get(
  '/review-artifacts/:reviewArtifactId/download/:kind',
  asyncHandler(async (req, res) => {
    const { reviewArtifactId, kind } = req.params;
    if (!['docx', 'pdf'].includes(kind)) {
      return res.status(400).json({ error: { message: 'kind must be docx or pdf' } });
    }
    const { buffer } = await service.getReviewedBuffer(reviewArtifactId, kind);
    const contentType =
      kind === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="reviewed.${kind}"`);
    res.send(buffer);
  })
);

module.exports = router;
