const { QuestionSet, QuestionSetVersion } = require('../../db');
const { NotFoundError, ValidationError, ConflictError } = require('../../common/errors');
const { validateQuestionSetDefinition } = require('./question-set.definition');

function toDto(questionSet) {
  return {
    id: questionSet.id,
    name: questionSet.name,
    description: questionSet.description,
    status: questionSet.status,
    latestVersionId: questionSet.latestVersionId,
    createdAt: questionSet.createdAt,
    updatedAt: questionSet.updatedAt,
  };
}

function toVersionDto(v) {
  return {
    id: v.id,
    questionSetId: v.questionSetId,
    versionNo: v.versionNo,
    status: v.status,
    definition: v.definition,
    publishedAt: v.publishedAt,
    createdAt: v.createdAt,
  };
}

async function listQuestionSets() {
  const sets = await QuestionSet.findAll({
    order: [['createdAt', 'DESC']],
    include: [{ model: QuestionSetVersion, as: 'latestVersion' }],
  });
  return sets.map((s) => ({ ...toDto(s), latestVersion: s.latestVersion ? toVersionDto(s.latestVersion) : null }));
}

async function getQuestionSet(id) {
  const set = await QuestionSet.findByPk(id, {
    include: [{ model: QuestionSetVersion, as: 'latestVersion' }],
  });
  if (!set) throw new NotFoundError('Question set not found');
  const versions = await QuestionSetVersion.findAll({
    where: { questionSetId: id },
    order: [['versionNo', 'DESC']],
  });
  return {
    ...toDto(set),
    latestVersion: set.latestVersion ? toVersionDto(set.latestVersion) : null,
    versions: versions.map(toVersionDto),
  };
}

async function createQuestionSet({ name, description, definition }) {
  if (!name || !name.trim()) throw new ValidationError('name is required');
  const check = validateQuestionSetDefinition(definition);
  if (!check.valid) throw new ValidationError('Invalid question set definition', check.errors);

  const set = await QuestionSet.create({ name: name.trim(), description: description || null, status: 'draft' });
  const version = await QuestionSetVersion.create({
    questionSetId: set.id,
    versionNo: 1,
    status: 'draft',
    definition,
  });
  await set.update({ latestVersionId: version.id });
  return getQuestionSet(set.id);
}

async function updateDraft(id, { name, description, definition }) {
  const set = await QuestionSet.findByPk(id);
  if (!set) throw new NotFoundError('Question set not found');

  if (definition !== undefined) {
    const check = validateQuestionSetDefinition(definition);
    if (!check.valid) throw new ValidationError('Invalid question set definition', check.errors);
  }

  const latest = await QuestionSetVersion.findByPk(set.latestVersionId);
  if (latest && latest.status === 'published') {
    const newVersion = await QuestionSetVersion.create({
      questionSetId: set.id,
      versionNo: latest.versionNo + 1,
      status: 'draft',
      definition: definition !== undefined ? definition : latest.definition,
    });
    await set.update({
      latestVersionId: newVersion.id,
      name: name !== undefined ? name.trim() : set.name,
      description: description !== undefined ? description : set.description,
    });
  } else {
    await set.update({
      name: name !== undefined ? name.trim() : set.name,
      description: description !== undefined ? description : set.description,
    });
    if (definition !== undefined) {
      await latest.update({ definition });
    }
  }
  return getQuestionSet(id);
}

async function publishQuestionSet(id) {
  const set = await QuestionSet.findByPk(id);
  if (!set) throw new NotFoundError('Question set not found');

  const version = await QuestionSetVersion.findByPk(set.latestVersionId);
  if (!version) throw new ConflictError('No draft version to publish');
  if (version.status === 'published') throw new ConflictError('Latest version is already published');

  const check = validateQuestionSetDefinition(version.definition);
  if (!check.valid) {
    throw new ValidationError('Cannot publish: invalid definition', check.errors);
  }

  const t = await version.sequelize.transaction();
  try {
    await QuestionSetVersion.update(
      { status: 'published', publishedAt: new Date() },
      { where: { questionSetId: id, status: 'draft' }, transaction: t }
    );
    await set.update({ status: 'published', latestVersionId: version.id }, { transaction: t });
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  return getQuestionSet(id);
}

async function deleteQuestionSet(id) {
  const set = await QuestionSet.findByPk(id);
  if (!set) throw new NotFoundError('Question set not found');
  await QuestionSetVersion.destroy({ where: { questionSetId: id } });
  await set.destroy();
  return { id };
}

module.exports = {
  listQuestionSets,
  getQuestionSet,
  createQuestionSet,
  updateDraft,
  publishQuestionSet,
  deleteQuestionSet,
};
