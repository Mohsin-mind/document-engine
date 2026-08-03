const { Worker } = require('bullmq');
const { getConnection } = require('../src/queues/connection');
const { QUEUE_NAMES, JOB_NAMES } = require('../src/queues/job-names');
const { getPdfQueue } = require('../src/queues/queues');
const { renderDocx } = require('./render.service');
const { getStorage } = require('../src/common/storage');
const { GenerationJob, Artifact } = require('../src/db');

const setJob = (id, patch) =>
  GenerationJob.update(patch, { where: { id } }).catch((err) =>
    console.error('[docx-worker] db update failed:', err.message)
  );

function createDocxWorker(concurrency = 2) {
  const worker = new Worker(
    QUEUE_NAMES.DOCX,
    async (job) => {
      const { generationJobId, submissionId, templateKey, renderPayload, docxKey } = job.data;
      const storage = getStorage();

      await setJob(generationJobId, { status: 'rendering_docx', progress: 10, attempts: job.attemptsMade + 1 });
      await job.updateProgress(10);

      const templateBuffer = await storage.read({ key: templateKey });

      await setJob(generationJobId, { progress: 50 });
      await job.updateProgress(50);
      const docxBuffer = renderDocx(templateBuffer, renderPayload);

      await setJob(generationJobId, { progress: 90 });
      await job.updateProgress(90);
      await storage.save({ key: docxKey, data: docxBuffer });

      await job.updateProgress(100);
      const artifact = await Artifact.create({
        submissionId,
        generationJobId,
        kind: 'docx',
        source: 'original',
        storageKey: docxKey,
      });
      await setJob(generationJobId, {
        docxArtifactId: artifact.id,
        progress: 100,
        status: 'converting_pdf',
      });

      const pdfKey = docxKey.replace(/\.docx$/, '.pdf');
      await getPdfQueue().add(
        JOB_NAMES.CONVERT_PDF,
        { generationJobId, submissionId, docxKey, pdfKey },
        { jobId: `gen-${generationJobId}-pdf` }
      );

      return { outputKey: docxKey };
    },
    { connection: getConnection(), concurrency }
  );

  worker.on('failed', (job, err) => {
    const generationJobId = job?.data?.generationJobId;
    if (generationJobId) {
      setJob(generationJobId, {
        status: 'failed',
        error: { message: err.message, attempts: job.attemptsMade },
      });
    }
    console.error(`[docx-worker] job ${job.id} failed:`, err.message);
  });

  worker.on('stalled', (jobId) => {
    console.error(`[docx-worker] job ${jobId} stalled`);
  });

  return worker;
}

module.exports = { createDocxWorker, JOB_NAMES };
