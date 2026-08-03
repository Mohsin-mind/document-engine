const config = require('../src/config');
const { createDocxWorker } = require('./docx.worker');
const { createPdfWorker } = require('./pdf.worker');

const workerType = process.env.WORKER_TYPE || 'all';

async function main() {
  const workers = [];
  if (workerType === 'all' || workerType === 'docx') {
    workers.push(createDocxWorker(parseInt(process.env.DOCX_CONCURRENCY || '2', 10)));
    console.log('[workers] docx-worker started');
  }
  if (workerType === 'all' || workerType === 'pdf') {
    workers.push(createPdfWorker(parseInt(process.env.PDF_CONCURRENCY || '1', 10)));
    console.log('[workers] pdf-worker started');
  }

  const shutdown = async () => {
    console.log('[workers] shutting down...');
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[workers] failed to start:', err);
  process.exit(1);
});
