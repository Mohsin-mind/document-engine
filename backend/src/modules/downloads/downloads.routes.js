const express = require('express');
const { asyncHandler } = require('../../common/async-handler');
const { Submission, GenerationJob, Artifact, DocumentMapping, TemplateVersion, Template } = require('../../db');

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
            { model: Artifact, as: 'artifacts' },
            {
              model: DocumentMapping,
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
        const def = job.DocumentMapping;
        return {
          id: job.id,
          documentName: def?.name || 'Document',
          templateName: def?.TemplateVersion?.Template?.name || null,
          status: job.status,
          completedAt: job.completedAt,
          artifacts: (job.artifacts || []).map((a) => ({
            id: a.id,
            kind: a.kind,
            source: a.source,
            url: `/api/artifacts/${a.id}/download`,
          })),
        };
      }),
    }));

    res.json({ total: count, page, limit, data });
  })
);

module.exports = router;
