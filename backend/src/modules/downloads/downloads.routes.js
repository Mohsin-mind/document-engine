const express = require('express');
const { asyncHandler } = require('../../common/async-handler');
const { Submission, GenerationJob, Artifact, ReviewArtifact, DocumentDefinition, TemplateVersion, Template } = require('../../db');
const { getStorage } = require('../../common/storage');
const { NotFoundError } = require('../../common/errors');

const router = express.Router();

// ── List all submissions with download-ready artifacts ───────────────────────
router.get(
  '/downloads',
  asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
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

    const data = rows.map((submission) => ({
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submittedAt,
      createdAt: submission.createdAt,
      jobs: (submission.jobs || []).map((job) => {
        const def = job.DocumentDefinition;
        return {
          id: job.id,
          documentName: def?.name || 'Document',
          templateName: def?.TemplateVersion?.Template?.name || null,
          status: job.status,
          completedAt: job.completedAt,
          artifacts: (job.artifacts || []).map((a) => {
            const review = a.ReviewArtifact;
            return {
              id: a.id,
              kind: a.kind,
              source: a.source,
              url: `/api/artifacts/${a.id}/download`,
              review: review
                ? {
                    id: review.id,
                    status: review.status,
                    approvedAt: review.approvedAt,
                    reviewedDocxUrl: review.reviewedDocxKey
                      ? `/api/review-artifacts/${review.id}/download/docx`
                      : null,
                    reviewedPdfUrl: review.reviewedPdfKey
                      ? `/api/review-artifacts/${review.id}/download/pdf`
                      : null,
                  }
                : null,
            };
          }),
        };
      }),
    }));

    res.json({ total: count, page, limit, data });
  })
);

module.exports = router;
