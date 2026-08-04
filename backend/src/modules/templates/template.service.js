const PizZip = require('pizzip');
const { randomUUID } = require('crypto');
const { Template, TemplateVersion, DocumentDefinition, QuestionSetVersion, QuestionSet, Rule } = require('../../db');
const { NotFoundError, ValidationError, ConflictError } = require('../../common/errors');
const { getStorage } = require('../../common/storage');
const { extractVariables } = require('./extract.service');
const { prepareDocxForRender } = require('./docx.prepare');
const { validateMappings, buildRenderContext, mappingsFromVariables } = require('./render.context');
const { renderDocx, convertToPdf } = require('../../../workers/render.service');
const { evaluate } = require('../rules/rule-engine');

function toTemplateDto(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    latestVersionId: t.latestVersionId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function toVersionDto(v) {
  return {
    id: v.id,
    templateId: v.templateId,
    versionNo: v.versionNo,
    status: v.status,
    storageKey: v.storageKey,
    extractedVariables: v.extractedVariables,
    mappingStatus: v.mappingStatus,
    docxTestStatus: v.docxTestStatus,
    pdfTestStatus: v.pdfTestStatus,
    testDocxKey: v.testDocxKey,
    testPdfKey: v.testPdfKey,
    publishedAt: v.publishedAt,
    createdAt: v.createdAt,
  };
}

function toDefinitionDto(d) {
  if (!d) return null;
  return {
    id: d.id,
    templateVersionId: d.templateVersionId,
    questionSetId: d.questionSetId,
    name: d.name,
    status: d.status,
    publishedAt: d.publishedAt,
  };
}

async function listTemplates() {
  const templates = await Template.findAll({
    order: [['createdAt', 'DESC']],
    include: [{ model: TemplateVersion, as: 'latestVersion' }],
  });
  return templates.map((t) => ({
    ...toTemplateDto(t),
    latestVersion: t.latestVersion ? toVersionDto(t.latestVersion) : null,
  }));
}

async function getTemplate(id) {
  const template = await Template.findByPk(id);
  if (!template) throw new NotFoundError('Template not found');
  const versions = await TemplateVersion.findAll({
    where: { templateId: id },
    order: [['versionNo', 'DESC']],
  });
  const definitions = await DocumentDefinition.findAll({
    where: { templateVersionId: versions.map((v) => v.id) },
  });
  return {
    ...toTemplateDto(template),
    versions: versions.map((v) => ({
      ...toVersionDto(v),
      definition: toDefinitionDto(definitions.find((d) => d.templateVersionId === v.id)),
    })),
  };
}

async function getVersion(templateId, versionId) {
  const version = await TemplateVersion.findOne({ where: { id: versionId, templateId } });
  if (!version) throw new NotFoundError('Template version not found');
  const definition = await DocumentDefinition.findOne({ where: { templateVersionId: version.id } });
  return { ...toVersionDto(version), definition: toDefinitionDto(definition) };
}

async function createTemplate({ name, description, questionSetId, file }) {
  if (!name || !name.trim()) throw new ValidationError('name is required');
  if (!file) throw new ValidationError('A DOCX file is required');
  if (!/\.docx$/i.test(file.originalname)) throw new ValidationError('Only .docx files are supported');

  const prepared = prepareDocxForRender(file.buffer);
  const extractedVariables = extractVariables(prepared).map((v) => ({
    id: randomUUID(),
    name: v.name,
    type: v.type,
    jsonPath: null,
  }));
  const template = await Template.create({
    name: name.trim(),
    description: description || null,
    status: 'draft',
  });
  const storage = getStorage();
  const storageKey = `templates/${template.id}/v1/prepared.docx`;
  await storage.save({ key: `templates/${template.id}/v1/source.docx`, data: file.buffer });
  await storage.save({ key: storageKey, data: prepared });
  const version = await TemplateVersion.create({
    templateId: template.id,
    versionNo: 1,
    status: 'draft',
    storageKey,
    extractedVariables,
    mappingStatus: 'unmapped',
  });
  await template.update({ latestVersionId: version.id });
  await DocumentDefinition.create({
    templateVersionId: version.id,
    questionSetId: questionSetId || null,
    name: template.name,
    status: 'draft',
  });
  return getVersion(template.id, version.id);
}

async function saveMappings(templateId, versionId, { mappings, sampleCanonical }) {
  const version = await getVersion(templateId, versionId);
  if (version.status === 'published') {
    throw new ConflictError('Published versions are immutable');
  }
  if (!sampleCanonical || typeof sampleCanonical !== 'object') {
    throw new ValidationError('sampleCanonical (the canonical JSON used for validation) is required');
  }
  const normalized = Array.isArray(mappings)
    ? mappings
    : Object.entries(mappings || {}).map(([docxTag, canonicalPath]) => ({ docxTag, canonicalPath }));
  if (normalized.length === 0) {
    throw new ValidationError('At least one mapping is required');
  }
  const check = validateMappings(sampleCanonical, normalized);
  if (!check.valid) {
    throw new ValidationError('Mapping validation failed', check.errors.map((e) => `${e.tag}: ${e.message}`));
  }

  const versionRow = await TemplateVersion.findByPk(version.id);
  if (!versionRow) throw new NotFoundError('Template version not found');
  const byTag = new Map(check.entries.map((e) => [e.docxTag, e.canonicalPath]));
  const known = new Set((versionRow.extractedVariables || []).map((v) => v.name));
  const unknown = check.entries.filter((e) => !known.has(e.docxTag));
  if (unknown.length > 0) {
    throw new ValidationError('Mapping validation failed', unknown.map((e) => `${e.docxTag}: tag not found in template`));
  }
  const missing = (versionRow.extractedVariables || []).filter((v) => !byTag.has(v.name));
  if (missing.length > 0) {
    throw new ValidationError(
      'Mapping validation failed',
      missing.map((v) => `${v.name}: no mapping provided`)
    );
  }
  const extractedVariables = (versionRow.extractedVariables || []).map((v) => ({
    ...v,
    jsonPath: byTag.has(v.name) ? byTag.get(v.name) : null,
  }));
  await versionRow.update({ extractedVariables, mappingStatus: 'mapped-validated' });
  const saved = await getVersion(templateId, versionId);
  return { ...saved, validation: check.results };
}

async function runRenderTest(templateId, versionId, { sampleCanonical }) {
  const version = await getVersion(templateId, versionId);
  if (version.status === 'published') {
    throw new ConflictError('Published versions are immutable');
  }
  if (!sampleCanonical || typeof sampleCanonical !== 'object') {
    throw new ValidationError('sampleCanonical is required to run the render test');
  }
  const versionRow = await TemplateVersion.findByPk(version.id);
  if (!versionRow) throw new NotFoundError('Template version not found');
  const mappings = mappingsFromVariables(versionRow.extractedVariables);
  const missingMappings = (versionRow.extractedVariables || []).filter((v) => !v.jsonPath);
  if (missingMappings.length > 0) {
    throw new ValidationError(
      'Mapping validation failed against the sample payload',
      missingMappings.map((v) => `${v.name}: no mapping provided`)
    );
  }
  const check = validateMappings(sampleCanonical, mappings);
  if (!check.valid) {
    throw new ValidationError(
      'Mapping validation failed against the sample payload',
      check.errors.map((e) => `${e.tag}: ${e.message}`)
    );
  }

  const storage = getStorage();
  const source = await storage.read({ key: version.storageKey });
  const context = buildRenderContext(sampleCanonical, mappings);

  const docxBuffer = renderDocx(source, context);
  const missing = findMissingMarkers(docxBuffer);
  if (missing.length > 0) {
    throw new ValidationError(
      'Render test failed',
      missing.map((m) => `Unmapped or missing value: ${m}`)
    );
  }
  const testDocxKey = `templates/${templateId}/v${version.versionNo}/test.docx`;
  await storage.save({ key: testDocxKey, data: docxBuffer });

  let pdfError = null;
  let testPdfKey = null;
  try {
    const pdfBuffer = await convertToPdf(docxBuffer);
    testPdfKey = `templates/${templateId}/v${version.versionNo}/test.pdf`;
    await storage.save({ key: testPdfKey, data: pdfBuffer });
  } catch (err) {
    pdfError = err.message;
  }

  await TemplateVersion.update(
    {
      docxTestStatus: 'passed',
      pdfTestStatus: pdfError ? 'failed' : 'passed',
      testDocxKey,
      testPdfKey: pdfError ? null : testPdfKey,
    },
    { where: { id: version.id } }
  );
  return getVersion(templateId, versionId);
}

function findMissingMarkers(docxBuffer) {
  const zip = new PizZip(docxBuffer);
  const found = [];
  for (const file of Object.values(zip.files)) {
    if (!file.name.endsWith('.xml')) continue;
    const text = file.asText();
    const re = /\[MISSING:([^\]]+)\]/g;
    let m;
    while ((m = re.exec(text))) found.push(`[MISSING:${m[1]}]`);
  }
  return [...new Set(found)];
}

async function publishTemplate(templateId, versionId) {
  const version = await getVersion(templateId, versionId);
  if (version.status === 'published') throw new ConflictError('Already published');

  const gates = [
    { name: 'mappings', ok: version.mappingStatus === 'mapped-validated', message: 'Mappings are not validated' },
    { name: 'docx test', ok: version.docxTestStatus === 'passed', message: 'DOCX render test has not passed' },
    { name: 'pdf test', ok: version.pdfTestStatus === 'passed', message: 'PDF conversion test has not passed' },
  ];
  const failed = gates.filter((g) => !g.ok);
  if (failed.length > 0) {
    throw new ValidationError('Cannot publish', failed.map((g) => `${g.name}: ${g.message}`));
  }

  const definition = await DocumentDefinition.findOne({ where: { templateVersionId: version.id } });
  const t = await TemplateVersion.sequelize.transaction();
  try {
    await TemplateVersion.update(
      { status: 'published', publishedAt: new Date() },
      { where: { id: version.id }, transaction: t }
    );
    await Template.update({ status: 'published', latestVersionId: version.id }, { where: { id: templateId }, transaction: t });
    if (definition) {
      await DocumentDefinition.update(
        { status: 'published', publishedAt: new Date() },
        { where: { id: definition.id }, transaction: t }
      );
    }
    await t.commit();
  } catch (err) {
    await t.rollback();
    throw err;
  }
  return getVersion(templateId, versionId);
}

function buildSampleAnswers(definition) {
  const answers = {};
  for (const section of definition.sections || []) {
    if (section.repeatable) {
      answers[section.repeatable.id] = [{}];
      for (const f of section.repeatable.fields || []) {
        answers[section.repeatable.id][0][f.id] = sampleValue(f.type, f.options);
      }
    }
    for (const q of section.questions || []) {
      answers[q.id] = sampleValue(q.type, q.options);
    }
  }
  return answers;
}

function sampleValue(type, options) {
  switch (type) {
    case 'number':
      return 42;
    case 'date':
      return '2026-01-15';
    case 'dropdown':
      return options && options[0] ? options[0].value ?? options[0] : 'Option 1';
    case 'yesno':
      return 'yes';
    case 'checkbox':
      return true;
    default:
      return 'Sample value';
  }
}

function flattenPaths(value, prefix, out) {
  if (Array.isArray(value)) {
    const arrPath = prefix ? `${prefix}[]` : '[]';
    out.push(arrPath);
    if (value.length > 0 && value[0] && typeof value[0] === 'object') {
      flattenPaths(value[0], arrPath, out);
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      flattenPaths(v, prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out.push(prefix);
  return out;
}

async function generateSampleCanonical(templateId) {
  const template = await Template.findByPk(templateId);
  if (!template) throw new NotFoundError('Template not found');
  const versions = await TemplateVersion.findAll({
    where: { templateId },
    order: [['versionNo', 'DESC']],
  });
  const definition = await DocumentDefinition.findOne({
    where: { templateVersionId: versions[0].id },
  });
  if (!definition || !definition.questionSetId) {
    throw new ValidationError('Template is not bound to a question set — bind one before generating a sample');
  }
  const questionSetVersion = await QuestionSetVersion.findOne({
    where: { questionSetId: definition.questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
  });
  if (!questionSetVersion) {
    throw new ValidationError('The bound question set has no published version');
  }
  const rule = await Rule.findOne({
    where: { questionSetId: definition.questionSetId, status: 'published' },
    order: [['versionNo', 'DESC']],
  });
  if (!rule) {
    throw new ValidationError('The bound question set has no published rule');
  }
  const answers = buildSampleAnswers(questionSetVersion.definition);
  const canonical = evaluate(rule.definition, answers);
  if (canonical.flags && Object.keys(canonical.flags).length === 0) {
    delete canonical.flags;
  }
  const paths = [...new Set(flattenPaths(canonical, '', []))];
  const set = await QuestionSet.findByPk(definition.questionSetId);
  return {
    canonical,
    paths,
    answers,
    questionSetName: set ? set.name : null,
    ruleVersionNo: rule.versionNo,
  };
}

async function updateTemplateMetadata(id, { name, description, questionSetId }) {
  const template = await Template.findByPk(id);
  if (!template) throw new NotFoundError('Template not found');
  await template.update({
    name: name !== undefined ? name.trim() : template.name,
    description: description !== undefined ? description : template.description,
  });
  if (questionSetId !== undefined) {
    await DocumentDefinition.update(
      { questionSetId: questionSetId || null },
      { where: { templateVersionId: template.latestVersionId } }
    );
  }
  return getTemplate(id);
}

async function deleteTemplate(id) {
  const template = await Template.findByPk(id);
  if (!template) throw new NotFoundError('Template not found');
  const versions = await TemplateVersion.findAll({ where: { templateId: id } });
  await DocumentDefinition.destroy({ where: { templateVersionId: versions.map((v) => v.id) } });
  await TemplateVersion.destroy({ where: { templateId: id } });
  await template.destroy();
  return { id };
}

module.exports = {
  listTemplates,
  getTemplate,
  getVersion,
  createTemplate,
  saveMappings,
  runRenderTest,
  publishTemplate,
  generateSampleCanonical,
  updateTemplateMetadata,
  deleteTemplate,
};
