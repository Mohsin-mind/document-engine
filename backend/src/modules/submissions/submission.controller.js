const service = require('./submission.service');
const { asyncHandler } = require('../../common/async-handler');

const questionnaire = asyncHandler(async (req, res) => {
  res.json({ data: await service.getPublishedQuestionnaire() });
});

const create = asyncHandler(async (req, res) => {
  const submission = await service.createDraft(req.body);
  res.status(201).json({ data: submission });
});

const getById = asyncHandler(async (req, res) => {
  res.json({ data: await service.getSubmission(req.params.id) });
});

const update = asyncHandler(async (req, res) => {
  res.json({ data: await service.updateDraft(req.params.id, req.body) });
});

const submit = asyncHandler(async (req, res) => {
  res.json({ data: await service.submit(req.params.id) });
});

module.exports = { questionnaire, create, getById, update, submit };
