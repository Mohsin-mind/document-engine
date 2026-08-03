const { QueueEvents } = require('bullmq');
const { getConnection } = require('../../queues/connection');
const { QUEUE_NAMES } = require('../../queues/job-names');
const { getJobsForSubmission, getJobByBullmqId } = require('./generation.service');

const subscribers = new Map();
let started = false;

function subscribe(submissionId, res) {
  let set = subscribers.get(submissionId);
  if (!set) {
    set = new Set();
    subscribers.set(submissionId, set);
  }
  set.add(res);
  res.on('close', () => {
    set.delete(res);
    if (set.size === 0) subscribers.delete(submissionId);
  });
}

function publish(submissionId, payload) {
  const set = subscribers.get(submissionId);
  if (!set || set.size === 0) return;
  const body = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    if (res.writableEnded) {
      set.delete(res);
      continue;
    }
    res.write(body);
  }
}

async function emitForJob(bullmqJobId, type, extra = {}) {
  const row = await getJobByBullmqId(bullmqJobId);
  if (!row) return;
  const jobs = await getJobsForSubmission(row.submissionId);
  const job = jobs.find((j) => j.id === row.id) || null;
  publish(row.submissionId, { type, job, ...extra });
}

function startGenerationEventRelay() {
  if (started) return;
  started = true;
  for (const queueName of [QUEUE_NAMES.DOCX, QUEUE_NAMES.PDF]) {
    const events = new QueueEvents(queueName, { connection: getConnection() });
    events.on('completed', ({ jobId }) => {
      emitForJob(jobId, 'job-completed').catch((err) =>
        console.error('[generation-events] completed relay failed:', err.message)
      );
    });
    events.on('failed', ({ jobId, failedReason }) => {
      emitForJob(jobId, 'job-failed', { error: failedReason }).catch((err) =>
        console.error('[generation-events] failed relay failed:', err.message)
      );
    });
    events.on('progress', ({ jobId, data }) => {
      emitForJob(jobId, 'job-progress', { progress: data }).catch((err) =>
        console.error('[generation-events] progress relay failed:', err.message)
      );
    });
  }
  console.log('[generation-events] relay started');
}

module.exports = { subscribe, publish, startGenerationEventRelay };
