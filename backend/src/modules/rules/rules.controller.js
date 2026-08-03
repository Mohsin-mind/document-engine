const service = require('./rules.service');
const { asyncHandler } = require('../../common/async-handler');

const list = asyncHandler(async (req, res) => {
  const rules = await service.listRules(req.query.questionSetId);
  res.json({ data: rules });
});

const create = asyncHandler(async (req, res) => {
  const rule = await service.createRule(req.body);
  res.status(201).json({ data: rule });
});

const getById = asyncHandler(async (req, res) => {
  const rule = await service.getRule(req.params.id);
  res.json({ data: rule });
});

const update = asyncHandler(async (req, res) => {
  const rule = await service.updateDraft(req.params.id, req.body);
  res.json({ data: rule });
});

const publish = asyncHandler(async (req, res) => {
  const rule = await service.publishRule(req.params.id);
  res.json({ data: rule });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteRule(req.params.id);
  res.json({ data: result });
});

const test = asyncHandler(async (req, res) => {
  const result = await service.testRule(req.params.id, req.body);
  res.json({ data: result });
});

module.exports = { list, create, getById, update, publish, remove, test };
