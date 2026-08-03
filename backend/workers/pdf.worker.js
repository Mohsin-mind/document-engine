const { Worker } = require('bullmq');
const { getConnection } = require('../src/queues/connection');
const { QUEUE_NAMES, JOB_NAMES } = require('../src/queues/job-names');
const { convertToPdf } = require('./render.service');
const { getStorage } = require('../src/common/storage');
const { GenerationJob, Artifact } = require('../src/db');

const setJob = (id, patch) =>
  GenerationJob.update(patch, { where: { id } }).catch((err) =>
    console.error('[pdf-worker] db update failed:', err.message)
  );

function createPdfWorker(concurrency = 1) {
  const worker = new Worker(
    QUEUE_NAMES.PDF,
    async (job) => {
      const { generationJobId, submissionId, docxKey, pdfKey } = job.data;
      const storage = getStorage();

      await setJob(generationJobId, { progress: 10, attempts: job.attemptsMade + 1 });
      await job.updateProgress(10);

      const docxBuffer = await storage.read({ key: docxKey });

      await setJob(generationJobId, { progress: 50 });
      await job.updateProgress(50);
      const pdfBuffer = await convertToPdf(docxBuffer);

      await setJob(generationJobId, { progress: 90 });
      await job.updateProgress(90);
      await storage.save({ key: pdfKey, data: pdfBuffer });

      await job.updateProgress(100);
      const artifact = await Artifact.create({
        submissionId,
        generationJobId,
        kind: 'pdf',
        source: 'original',
        storageKey: pdfKey,
      });
      await setJob(generationJobId, {
        pdfArtifactId: artifact.id,
        progress: 100,
        status: 'completed',
        completedAt: new Date(),
      });

      return { outputKey: pdfKey };
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
    console.error(`[pdf-worker] job ${job.id} failed:`, err.message);
  });

  worker.on('stalled', (jobId) => {
    console.error(`[pdf-worker] job ${jobId} stalled`);
  });

  return worker;
}

module.exports = { createPdfWorker, JOB_NAMES };
