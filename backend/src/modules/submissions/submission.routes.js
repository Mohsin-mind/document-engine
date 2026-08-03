const express = require('express');
const ctrl = require('./submission.controller');

const router = express.Router();

router.get('/questionnaire', ctrl.questionnaire);
router.post('/submissions', ctrl.create);
router.get('/submissions/:id', ctrl.getById);
router.put('/submissions/:id', ctrl.update);
router.post('/submissions/:id/submit', ctrl.submit);

module.exports = router;
