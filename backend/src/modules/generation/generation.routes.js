const express = require('express');
const { asyncHandler } = require('../../common/async-handler');
const { NotFoundError } = require('../../common/errors');
const { getStorage } = require('../../common/storage');
const { Artifact } = require('../../db');
const { getJobsForSubmission } = require('./generation.service');
const { subscribe } = require('./generation.events');

const router = express.Router();

router.get(
  '/submissions/:submissionId/jobs',
  asyncHandler(async (req, res) => {
    const jobs = await getJobsForSubmission(req.params.submissionId);
    res.json({ data: jobs });
  })
);

router.get('/submissions/:submissionId/jobs/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  subscribe(req.params.submissionId, res);
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
  res.on('close', () => clearInterval(heartbeat));
});

router.get(
  '/artifacts/:artifactId/download',
  asyncHandler(async (req, res) => {
    const artifact = await Artifact.findByPk(req.params.artifactId);
    if (!artifact) throw new NotFoundError('Artifact not found');
    const storage = getStorage();
    const buf = await storage.read({ key: artifact.storageKey });
    const contentType =
      artifact.kind === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="document.${artifact.kind}"`);
    res.send(buf);
  })
);

module.exports = router;
