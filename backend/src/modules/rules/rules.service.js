const { Rule, QuestionSet } = require('../../db');
const { NotFoundError, ValidationError, ConflictError } = require('../../common/errors');
const { validateRuleDefinition, evaluate } = require('./rule-engine');

function toDto(r) {
  return {
    id: r.id,
    questionSetId: r.questionSetId,
    versionNo: r.versionNo,
    status: r.status,
    definition: r.definition,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
  };
}

async function ensureQuestionSet(id) {
  const set = await QuestionSet.findByPk(id);
  if (!set) throw new NotFoundError('Question set not found');
  return set;
}

async function listRules(questionSetId) {
  const rules = await Rule.findAll({
    where: questionSetId ? { questionSetId } : {},
    order: [['createdAt', 'DESC']],
  });
  return rules.map(toDto);
}

async function getRule(id) {
  const rule = await Rule.findByPk(id);
  if (!rule) throw new NotFoundError('Rule not found');
  return toDto(rule);
}

async function createRule({ questionSetId, definition }) {
  await ensureQuestionSet(questionSetId);
  const check = validateRuleDefinition(definition);
  if (!check.valid) throw new ValidationError('Invalid rule definition', check.errors);

  const existing = await Rule.findOne({ where: { questionSetId }, order: [['versionNo', 'DESC']] });
  const rule = await Rule.create({
    questionSetId,
    versionNo: (existing ? existing.versionNo : 0) + 1,
    status: 'draft',
    definition,
  });
  return toDto(rule);
}

async function updateDraft(id, { definition }) {
  const rule = await Rule.findByPk(id);
  if (!rule) throw new NotFoundError('Rule not found');

  if (definition !== undefined) {
    const check = validateRuleDefinition(definition);
    if (!check.valid) throw new ValidationError('Invalid rule definition', check.errors);
  }

  if (rule.status === 'published') {
    const latest = await Rule.findOne({
      where: { questionSetId: rule.questionSetId },
      order: [['versionNo', 'DESC']],
    });
    const newRule = await Rule.create({
      questionSetId: rule.questionSetId,
      versionNo: latest.versionNo + 1,
      status: 'draft',
      definition: definition !== undefined ? definition : rule.definition,
    });
    return toDto(newRule);
  }

  if (definition !== undefined) {
    await rule.update({ definition });
  }
  return toDto(rule);
}

async function publishRule(id) {
  const rule = await Rule.findByPk(id);
  if (!rule) throw new NotFoundError('Rule not found');
  if (rule.status === 'published') throw new ConflictError('Rule is already published');

  const check = validateRuleDefinition(rule.definition);
  if (!check.valid) throw new ValidationError('Cannot publish: invalid definition', check.errors);

  await rule.update({ status: 'published', publishedAt: new Date() });
  return toDto(rule);
}

async function deleteRule(id) {
  const rule = await Rule.findByPk(id);
  if (!rule) throw new NotFoundError('Rule not found');
  await rule.destroy();
  return { id };
}

async function testRule(id, { answers }) {
  const rule = await Rule.findByPk(id);
  if (!rule) throw new NotFoundError('Rule not found');
  if (!answers || typeof answers !== 'object') throw new ValidationError('answers object is required');
  const canonical = evaluate(rule.definition, answers);
  return { canonical, answers };
}

module.exports = {
  listRules,
  getRule,
  createRule,
  updateDraft,
  publishRule,
  deleteRule,
  testRule,
};
