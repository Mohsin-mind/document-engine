const { GenerationJob, Artifact, DocumentMapping, TemplateVersion, Template } = require('../../db');
const { getDocxQueue } = require('../../queues/queues');
const { JOB_NAMES } = require('../../queues/job-names');

async function createAndEnqueueForSubmission(submissionId, documents) {
  const created = [];
  for (const doc of documents) {
    if (!doc.templateKey) continue;
    const jobRow = await GenerationJob.create({
      submissionId,
      documentMappingId: doc.id,
      status: 'queued',
    });
    const docxKey = `artifacts/${submissionId}/${jobRow.id}/docx.docx`;
    const queue = getDocxQueue();
    const job = await queue.add(
      JOB_NAMES.RENDER_DOCX,
      {
        generationJobId: jobRow.id,
        submissionId,
        templateKey: doc.templateKey,
        renderPayload: doc.renderPayload,
        docxKey,
      },
      { jobId: `gen-${jobRow.id}` }
    );
    await GenerationJob.update({ bullmqJobId: job.id }, { where: { id: jobRow.id } });
    created.push({ id: jobRow.id, documentName: doc.name, bullmqJobId: job.id });
  }
  return created;
}

function toJobDto(job) {
  const definition = job.DocumentMapping;
  return {
    id: job.id,
    documentName: definition?.name || 'Document',
    templateName: definition?.TemplateVersion?.Template?.name || null,
    status: job.status,
    progress: job.progress,
    attempts: job.attempts,
    error: job.error,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    artifacts: (job.artifacts || []).map((a) => ({
      id: a.id,
      kind: a.kind,
      url: `/api/artifacts/${a.id}/download`,
    })),
  };
}

async function getJobsForSubmission(submissionId) {
  const jobs = await GenerationJob.findAll({
    where: { submissionId },
    order: [['createdAt', 'ASC']],
    include: [
      { model: Artifact, as: 'artifacts' },
      {
        model: DocumentMapping,
        include: [{ model: TemplateVersion, include: [{ model: Template }] }],
      },
    ],
  });
  return jobs.map(toJobDto);
}

async function getJobByBullmqId(bullmqJobId) {
  return GenerationJob.findOne({ where: { bullmqJobId } });
}

module.exports = {
  createAndEnqueueForSubmission,
  getJobsForSubmission,
  getJobByBullmqId,
};
