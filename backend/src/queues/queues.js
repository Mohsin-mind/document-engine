const { Queue } = require('bullmq');
const { getConnection } = require('./connection');
const { QUEUE_NAMES, JOB_NAMES } = require('./job-names');

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};

const queueOptions = {
  [QUEUE_NAMES.DOCX]: {
    defaultJobOptions: { ...defaultJobOptions, timeout: 90000 },
    limiter: { max: 4, duration: 1000 },
  },
  [QUEUE_NAMES.PDF]: {
    defaultJobOptions: { ...defaultJobOptions, timeout: 180000 },
    limiter: { max: 2, duration: 1000 },
  },
};

const queues = {};

function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getConnection(),
      ...queueOptions[name],
    });
  }
  return queues[name];
}

function getDocxQueue() {
  return getQueue(QUEUE_NAMES.DOCX);
}

function getPdfQueue() {
  return getQueue(QUEUE_NAMES.PDF);
}

module.exports = {
  getQueue,
  getDocxQueue,
  getPdfQueue,
  JOB_NAMES,
  QUEUE_NAMES,
};
