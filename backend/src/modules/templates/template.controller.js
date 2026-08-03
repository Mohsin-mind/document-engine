const service = require('./template.service');
const { asyncHandler } = require('../../common/async-handler');

const list = asyncHandler(async (req, res) => {
  res.json({ data: await service.listTemplates() });
});

const create = asyncHandler(async (req, res) => {
  const template = await service.createTemplate({
    name: req.body.name,
    description: req.body.description,
    questionSetId: req.body.questionSetId,
    file: req.file,
  });
  res.status(201).json({ data: template });
});

const getById = asyncHandler(async (req, res) => {
  res.json({ data: await service.getTemplate(req.params.id) });
});

const saveMappings = asyncHandler(async (req, res) => {
  const version = await service.saveMappings(req.params.id, req.params.versionId, req.body);
  res.json({ data: version });
});

const runTest = asyncHandler(async (req, res) => {
  const version = await service.runRenderTest(req.params.id, req.params.versionId, req.body);
  res.json({ data: version });
});

const publish = asyncHandler(async (req, res) => {
  const version = await service.publishTemplate(req.params.id, req.params.versionId);
  res.json({ data: version });
});

const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateTemplateMetadata(req.params.id, req.body) });
});

const remove = asyncHandler(async (req, res) => {
  res.json({ data: await service.deleteTemplate(req.params.id) });
});

module.exports = { list, create, getById, saveMappings, runTest, publish, update, remove };
