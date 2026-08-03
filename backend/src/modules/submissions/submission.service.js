const { Submission, QuestionSet, QuestionSetVersion, Rule, CanonicalPayload, DocumentDefinition, Template, TemplateVersion } = require('../../db');
const { NotFoundError, ConflictError, ValidationError } = require('../../common/errors');
const { validateAnswers } = require('@document-engine/shared');
const { evaluate } = require('../rules/rule-engine');
const { buildRenderContext } = require('../templates/render.context');
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

  const rule = await Rule.findOne({
    where: { questionSetId: version.questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
  });
  if (!rule) {
    throw new ConflictError('No published rules are configured for this questionnaire');
  }

  const canonical = evaluate(rule.definition, submission.answers || {});
  const documents = await buildDocumentPreview(version.questionSetId, canonical);

  const t = await Submission.sequelize.transaction();
  try {
    await submission.update({ status: 'submitted', submittedAt: new Date() }, { transaction: t });
    await CanonicalPayload.upsert({ submissionId: submission.id, payload: canonical }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }

  try {
    await createAndEnqueueForSubmission(submission.id, documents);
  } catch (err) {
    console.error(`[submit] failed to enqueue generation jobs for submission ${submission.id}:`, err.message);
  }
  return { submission: toDto(submission), canonical, documents };
}

async function buildDocumentPreview(questionSetId, canonical) {
  const definitions = await DocumentDefinition.findAll({
    where: { questionSetId, status: 'published' },
    include: [{ model: TemplateVersion, include: [{ model: Template }] }],
  });
  return definitions.map((d) => {
    const version = d.TemplateVersion;
    return {
      id: d.id,
      name: d.name,
      templateName: version?.Template?.name || 'Template',
      templateKey: version?.status === 'published' ? version.storageKey : null,
      mappedVariables: Object.keys(d.mappings || {}).length,
      renderPayload: buildRenderContext(canonical, d.mappings || {}),
    };
  });
}

module.exports = {
  getPublishedQuestionnaire,
  createDraft,
  getSubmission,
  updateDraft,
  submit,
};
