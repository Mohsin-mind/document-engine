const service = require('./questions.service');
const { asyncHandler } = require('../../common/async-handler');

const list = asyncHandler(async (req, res) => {
  const sets = await service.listQuestionSets();
  res.json({ data: sets });
});

const create = asyncHandler(async (req, res) => {
  const set = await service.createQuestionSet(req.body);
  res.status(201).json({ data: set });
});

const getById = asyncHandler(async (req, res) => {
  const set = await service.getQuestionSet(req.params.id);
  res.json({ data: set });
});

const update = asyncHandler(async (req, res) => {
  const set = await service.updateDraft(req.params.id, req.body);
  res.json({ data: set });
});

const publish = asyncHandler(async (req, res) => {
  const set = await service.publishQuestionSet(req.params.id);
  res.json({ data: set });
});

const remove = asyncHandler(async (req, res) => {
  const result = await service.deleteQuestionSet(req.params.id);
  res.json({ data: result });
});

module.exports = { list, create, getById, update, publish, remove };
