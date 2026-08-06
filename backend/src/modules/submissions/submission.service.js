const { Submission, QuestionSet, QuestionSetVersion, QuestionSetRule, DocumentMapping, Template, TemplateVersion, GenerationJob, Artifact, ReviewArtifact } = require('../../db');
const { NotFoundError, ConflictError, ValidationError } = require('../../common/errors');
const { getStorage } = require('../../common/storage');
const { getDocxQueue, getPdfQueue } = require('../../queues/queues');
const { validateAnswers } = require('@document-engine/shared');
const { evaluate } = require('../rules/rule-engine');
const { buildRenderContext, mappingsFromVariables } = require('../templates/render.context');
const { createAndEnqueueForSubmission } = require('../generation/generation.service');

function toDto(submission) {
  return {
    id: submission.id,
    questionSetVersionId: submission.questionSetVersionId,
    status: submission.status,
    answers: submission.answers,
    submittedAt: submission.submittedAt,
    createdAt: submission.createdAt,
    updatedAt: submission.updatedAt,
  };
}

async function getPublishedQuestionnaire() {
  const version = await QuestionSetVersion.findOne({
    where: { status: 'published' },
    order: [['publishedAt', 'DESC']],
    include: [QuestionSet],
  });
  if (!version) throw new NotFoundError('No published questionnaire available');
  return {
    id: version.QuestionSet.id,
    name: version.QuestionSet.name,
    description: version.QuestionSet.description,
    versionId: version.id,
    definition: version.definition,
  };
}

async function createDraft({ answers }) {
  const questionnaire = await getPublishedQuestionnaire();
  const submission = await Submission.create({
    questionSetVersionId: questionnaire.versionId,
    status: 'draft',
    answers: answers || {},
  });
  return toDto(submission);
}

async function getSubmission(id) {
  const submission = await Submission.findByPk(id);
  if (!submission) throw new NotFoundError('Submission not found');
  return toDto(submission);
}

async function updateDraft(id, { answers }) {
  const submission = await Submission.findByPk(id);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status === 'submitted') {
    throw new ConflictError('Submitted submissions are immutable');
  }
  await submission.update({ answers: answers || {} });
  return toDto(submission);
}

async function submit(id) {
  const submission = await Submission.findByPk(id);
  if (!submission) throw new NotFoundError('Submission not found');
  if (submission.status === 'submitted') {
    throw new ConflictError('Submission already submitted');
  }
  const version = await QuestionSetVersion.findByPk(submission.questionSetVersionId);
  if (!version) throw new ConflictError('Questionnaire version no longer exists');

  const check = validateAnswers(version.definition, submission.answers || {});
  if (!check.valid) {
    throw new ValidationError('Answers are invalid', check.errors.map((e) => `${e.path}: ${e.message}`));
  }

  const rule = await QuestionSetRule.findOne({
    where: { questionSetId: version.questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
  });
  if (!rule) {
    throw new ConflictError('No published rules are configured for this questionnaire');
  }

  const canonical = evaluate(rule.definition, submission.answers || {});
  const documents = await buildDocumentPreview(version.questionSetId, canonical);
  if (documents.length === 0) {
    throw new ConflictError('No published documents are configured for this questionnaire');
  }

  const t = await Submission.sequelize.transaction();
  try {
    await submission.update({ status: 'submitted', submittedAt: new Date(), canonical }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  try {
    await createAndEnqueueForSubmission(submission.id, documents);
  } catch (err) {
    await Submission.update(
      { status: 'draft', submittedAt: null, canonical: null },
      { where: { id: submission.id } }
    );
    await GenerationJob.destroy({ where: { submissionId: submission.id } });
    throw err;
  }
  return { submission: toDto(submission), canonical, documents };
}

async function deleteSubmission(id) {
  const submission = await Submission.findByPk(id);
  if (!submission) throw new NotFoundError('Submission not found');

  const jobs = await GenerationJob.findAll({ where: { submissionId: id } });
  const jobIds = jobs.map((j) => j.id);
  const artifacts = await Artifact.findAll({ where: { submissionId: id } });
  const artifactIds = artifacts.map((a) => a.id);

  const t = await Submission.sequelize.transaction();
  try {
    if (artifactIds.length > 0) {
      await ReviewArtifact.destroy({ where: { artifactId: artifactIds }, transaction: t });
      await Artifact.destroy({ where: { id: artifactIds }, transaction: t });
    }
    if (jobIds.length > 0) {
      await GenerationJob.destroy({ where: { id: jobIds }, transaction: t });
    }
    await submission.destroy({ transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  for (const jobId of jobIds) {
    for (const queue of [getDocxQueue(), getPdfQueue()]) {
      try {
        await queue.remove(`gen-${jobId}`);
      } catch {
        // job already completed/not waiting — nothing to do
      }
    }
  }

  const storage = getStorage();
  for (const artifact of artifacts) {
    try {
      await storage.delete({ key: artifact.storageKey });
      const dir = artifact.storageKey.replace(/\/[^/]+$/, '');
      if (dir !== artifact.storageKey) {
        try {
          await storage.deleteDir(dir);
        } catch (err) {
          console.error(`[submissions] failed to clean dir ${dir}:`, err.message);
        }
      }
    } catch (err) {
      console.error(`[submissions] failed to delete artifact file ${artifact.storageKey}:`, err.message);
    }
  }
  try {
    await storage.deleteDir(`artifacts/${submission.id}`);
  } catch (err) {
    console.error(`[submissions] failed to clean artifact dirs for ${submission.id}:`, err.message);
  }

  return { id };
}

async function buildDocumentPreview(questionSetId, canonical) {
  const definitions = await DocumentMapping.findAll({
    where: { questionSetId, status: 'published' },
    include: [{ model: TemplateVersion, include: [{ model: Template }] }],
  });
  return definitions.map((d) => {
    const version = d.TemplateVersion;
    const variables = version?.extractedVariables || [];
    return {
      id: d.id,
      name: d.name,
      templateName: version?.Template?.name || 'Template',
      templateKey: version?.status === 'published' ? version.storageKey : null,
      mappedVariables: variables.filter((v) => v.jsonPath).length,
      renderPayload: buildRenderContext(canonical, mappingsFromVariables(variables)),
    };
  });
}

module.exports = {
  getPublishedQuestionnaire,
  createDraft,
  getSubmission,
  updateDraft,
  submit,
  deleteSubmission,
};
