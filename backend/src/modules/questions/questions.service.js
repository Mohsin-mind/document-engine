const { QuestionSet, QuestionSetVersion, QuestionSetRule, DocumentMapping, TemplateVersion } = require('../../db');
const { NotFoundError, ValidationError, ConflictError } = require('../../common/errors');
const {
  validateQuestionSetDefinition,
  stripClientMeta,
  missingKeys,
} = require('./question-set.definition');

async function findKeyReferences(questionSetId, key) {
  const refs = [];
  const rules = await QuestionSetRule.findAll({
    where: { questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
    attributes: ['id', 'versionNo', 'definition'],
  });
  for (const r of rules) {
    const d = r.definition || {};
    for (const f of d.flags || []) {
      let hit = false;
      const descend = (w) => {
        if (!w || hit) return;
        if (w.field === key || w.group === key) {
          hit = true;
          return;
        }
        if (Array.isArray(w.all)) w.all.forEach(descend);
        if (Array.isArray(w.any)) w.any.forEach(descend);
      };
      descend(f.when);
      if (hit) refs.push(`rule v${r.versionNo} (flag "${f.label || f.key || 'unnamed'}")`);
    }
    for (const c of d.computed || []) {
      const raw = String(c.template !== undefined ? c.template : c.value || '');
      if (raw.includes(`{answers.${key}}`) || raw.includes(`{answers.${key}.`)) {
        refs.push(`rule v${r.versionNo} (computed "${c.label || c.key || 'unnamed'}")`);
      }
    }
    if ((d.includeGroups || []).includes(key)) refs.push(`rule v${r.versionNo} (list "${key}")`);
    if (d.groupMaps && Object.prototype.hasOwnProperty.call(d.groupMaps, key)) {
      refs.push(`rule v${r.versionNo} (list mapping "${key}")`);
    }
  }

  const maps = await DocumentMapping.findAll({
    where: { questionSetId, status: 'published' },
    include: [{ model: TemplateVersion }],
  });
  for (const m of maps) {
    const tv = m.TemplateVersion;
    const used = (tv?.extractedVariables || []).some((v) => {
      const p = v.jsonPath || '';
      return p === key || p.startsWith(`${key}.`) || p.startsWith(`${key}[`);
    });
    if (used) refs.push(`template "${m.name}"${tv ? ` v${tv.versionNo}` : ''}`);
  }
  return refs;
}

async function assertKeysPreserved(questionSetId, nextDefinition) {
  const published = await QuestionSetVersion.findOne({
    where: { questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
  });
  if (!published) return;
  const missing = missingKeys(published.definition, nextDefinition);
  if (missing.length === 0) return;

  const blocked = [];
  for (const key of missing) {
    const refs = await findKeyReferences(questionSetId, key);
    if (refs.length > 0) {
      blocked.push(
        `"${key}" is still used by ${refs.join(' and ')} — update or remove those references first (publish a new rule or template version without them), then you can remove or rename this question. Or keep the question and add a new one with a new key instead.`
      );
    }
  }
  if (blocked.length === 0) return;
  throw new ValidationError('Question keys are locked after publish', blocked);
}

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
  const clean = stripClientMeta(definition);
  const check = validateQuestionSetDefinition(clean);
  if (!check.valid) throw new ValidationError('Invalid question set definition', check.errors);

  const set = await QuestionSet.create({ name: name.trim(), description: description || null, status: 'draft' });
  const version = await QuestionSetVersion.create({
    questionSetId: set.id,
    versionNo: 1,
    status: 'draft',
    definition: clean,
  });
  await set.update({ latestVersionId: version.id });
  return getQuestionSet(set.id);
}

async function updateDraft(id, { name, description, definition }) {
  const set = await QuestionSet.findByPk(id);
  if (!set) throw new NotFoundError('Question set not found');

  const clean = definition !== undefined ? stripClientMeta(definition) : undefined;
  if (clean !== undefined) {
    const check = validateQuestionSetDefinition(clean);
    if (!check.valid) throw new ValidationError('Invalid question set definition', check.errors);
    await assertKeysPreserved(id, clean);
  }

  const latest = await QuestionSetVersion.findByPk(set.latestVersionId);
  if (latest && latest.status === 'published') {
    const newVersion = await QuestionSetVersion.create({
      questionSetId: set.id,
      versionNo: latest.versionNo + 1,
      status: 'draft',
      definition: clean !== undefined ? clean : latest.definition,
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
    if (clean !== undefined) {
      await latest.update({ definition: clean });
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
  await assertKeysPreserved(id, version.definition);

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
