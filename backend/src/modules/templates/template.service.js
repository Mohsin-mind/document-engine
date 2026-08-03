const { Template, TemplateVersion, DocumentDefinition } = require('../../db');
const { NotFoundError, ValidationError, ConflictError } = require('../../common/errors');
const { getStorage } = require('../../common/storage');
const { extractVariables } = require('./extract.service');
const { prepareDocxForRender } = require('./docx.prepare');
const { validateMappings, buildRenderContext } = require('./render.context');
const { renderDocx, convertToPdf } = require('../../../workers/render.service');

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
    mappings: d.mappings,
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
  const extractedVariables = extractVariables(prepared);
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
    mappings: {},
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
  const check = validateMappings(sampleCanonical, normalized);
  if (!check.valid) {
    throw new ValidationError('Mapping validation failed', check.errors.map((e) => `${e.tag}: ${e.message}`));
  }

  const definition = await DocumentDefinition.findOne({ where: { templateVersionId: version.id } });
  if (!definition) throw new NotFoundError('Document definition not found');
  await definition.update({ mappings: Object.fromEntries(check.entries.map((e) => [e.docxTag, e.canonicalPath])) });
  await TemplateVersion.update({ mappingStatus: 'mapped-validated' }, { where: { id: version.id } });
  return getVersion(templateId, versionId);
}

async function runRenderTest(templateId, versionId, { sampleCanonical }) {
  const version = await getVersion(templateId, versionId);
  if (version.status === 'published') {
    throw new ConflictError('Published versions are immutable');
  }
  if (!sampleCanonical || typeof sampleCanonical !== 'object') {
    throw new ValidationError('sampleCanonical is required to run the render test');
  }
  const definition = await DocumentDefinition.findOne({ where: { templateVersionId: version.id } });
  if (!definition) throw new NotFoundError('Document definition not found');
  if (definition.mappings && Object.keys(definition.mappings).length > 0) {
    const check = validateMappings(sampleCanonical, definition.mappings);
    if (!check.valid) {
      throw new ValidationError(
        'Mapping validation failed against the sample payload',
        check.errors.map((e) => `${e.tag}: ${e.message}`)
      );
    }
  }

  const storage = getStorage();
  const source = await storage.read({ key: version.storageKey });
  const context = buildRenderContext(sampleCanonical, definition.mappings || {});

  const docxBuffer = renderDocx(source, context);
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
  updateTemplateMetadata,
  deleteTemplate,
};
